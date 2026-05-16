import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getQuestionnaireRiskLabel,
  normalizeQuestionnaireRiskCodes,
} from "@/lib/questionnaire-risks";
import { Card } from "@/components/ui/card";
import {
  PlaceTechnicalNotesCard,
  type MistoKonaniRow,
  type PlaceTechnicalNoteAuthorRow,
  type PlaceTechnicalNoteRow,
  type PlaceTechnicalNoteZakazkaRow,
} from "@/components/mista/PlaceTechnicalNotesCard";
import {
  PlaceTechnicalPhotoGallery,
  PlaceTechnicalPhotoUpload,
  type PlaceTechnicalPhotoGalleryItem,
} from "@/components/mista/PlaceTechnicalPhotosClient";

type PageProps = {
  params: Promise<{ id: string }>;
};

type PlaceZakazkaRow = {
  zakazka_id: string;
  cislo_zakazky: string | null;
  nazev: string | null;
  akce_od: string | null;
  datum_od: string | null;
  zrusena: boolean | null;
};

type PlaceDotaznikRow = {
  dotaznik_id: string;
  zakazka_id: string;
  stav: string | null;
  pozadovan_vyjezd_technika: boolean | null;
  rizika: unknown;
  submitted_at: string | null;
  updated_at: string | null;
};

type DotaznikPhotoCountRow = {
  dotaznik_odpoved_id: string | null;
};

type PlaceTechnicalPhotoRow = {
  id: string;
  misto_id: string;
  zakazka_id: string | null;
  autor_id: string | null;
  storage_bucket: string;
  storage_path: string;
  typ: string | null;
  popis: string | null;
  dulezite: boolean | null;
  original_filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string | null;
};

type TimelineEvent =
  | {
      id: string;
      type: "zakazka";
      date: string;
      zakazka: PlaceZakazkaRow;
    }
  | {
      id: string;
      type: "dotaznik";
      date: string;
      dotaznik: PlaceDotaznikRow;
      zakazka: PlaceZakazkaRow | undefined;
      photoCount: number;
    }
  | {
      id: string;
      type: "poznamka";
      date: string;
      note: PlaceTechnicalNoteRow;
      author: PlaceTechnicalNoteAuthorRow | undefined;
      zakazka: PlaceTechnicalNoteZakazkaRow | undefined;
    }
  | {
      id: string;
      type: "fotka";
      date: string;
      photo: PlaceTechnicalPhotoRow;
      author: PlaceTechnicalNoteAuthorRow | undefined;
      zakazka: PlaceTechnicalNoteZakazkaRow | undefined;
    };

function formatDate(value: string | null) {
  if (!value) return "Bez termínu";
  return new Date(value).toLocaleDateString("cs-CZ", { dateStyle: "medium" });
}

function formatDateTime(value: string | null) {
  if (!value) return "Bez data";
  return new Date(value).toLocaleString("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function getTimelineDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function formatTimelineDay(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("cs-CZ", {
    dateStyle: "full",
  });
}

function getZakazkaTitle(row: PlaceZakazkaRow | PlaceTechnicalNoteZakazkaRow | undefined, fallbackId?: string | null) {
  if (!row) return fallbackId ? `Zakázka ${fallbackId.slice(0, 8)}` : "Zakázka";
  return row.nazev || row.cislo_zakazky || `Zakázka ${row.zakazka_id.slice(0, 8)}`;
}

function getAuthorLabel(author: PlaceTechnicalNoteAuthorRow | undefined) {
  if (!author) return "Neznámý autor";
  return [author.jmeno, author.prijmeni].filter(Boolean).join(" ").trim() || author.email || "Neznámý autor";
}

function getZakazkaLabel(zakazka: PlaceTechnicalNoteZakazkaRow | undefined, zakazkaId: string | null) {
  if (!zakazkaId) return null;
  return getZakazkaTitle(zakazka, zakazkaId);
}

function formatNoteType(value: string | null) {
  if (value === "elektro") return "Elektro";
  if (value === "prijezd") return "Příjezd";
  if (value === "parkovani") return "Parkování";
  if (value === "stage") return "Stage";
  if (value === "hluk") return "Hluk";
  if (value === "omezeni") return "Omezení";
  if (value === "tip") return "Tip";
  if (value === "problem") return "Problém";
  return "Jiná";
}

function formatPhotoType(value: string | null) {
  if (value === "rozvadec") return "Rozvaděč";
  if (value === "prijezd") return "Příjezd";
  if (value === "parkovani") return "Parkování";
  if (value === "kabel") return "Kabelová trasa";
  if (value === "stage") return "Stage prostor";
  if (value === "omezeni") return "Omezení";
  if (value === "problem") return "Problém";
  return "Jiná";
}

function getDotaznikStatusLabel(dotaznik: PlaceDotaznikRow) {
  if (dotaznik.pozadovan_vyjezd_technika || dotaznik.stav === "pozadovan_vyjezd_technika") {
    return "Požadován výjezd technika";
  }

  if (dotaznik.stav === "vyplneno") return "Vyplněno klientem";
  if (dotaznik.stav === "overeno_interne") return "Ověřeno interně";
  if (dotaznik.stav === "neni_potreba") return "Není potřeba";
  return dotaznik.stav || "Dotazník";
}

function groupTimelineEvents(events: TimelineEvent[]) {
  const groups = new Map<string, TimelineEvent[]>();

  for (const event of events) {
    const key = getTimelineDayKey(event.date);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return [...groups.entries()]
    .map(([day, items]) => ({
      day,
      items: items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  if (event.type === "zakazka") {
    const title = getZakazkaTitle(event.zakazka);

    return (
      <article className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-blue-200">Zakázka na místě</div>
            <Link
              href={`/zakazky/${event.zakazka.zakazka_id}`}
              className="mt-1 block text-base font-black text-white hover:text-blue-100 hover:underline"
            >
              {title}
            </Link>
          </div>
          <div className="text-xs text-slate-400">{formatDateTime(event.date)}</div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
            {event.zakazka.zrusena ? "Zrušená" : "Aktivní / historická"}
          </span>
        </div>
      </article>
    );
  }

  if (event.type === "dotaznik") {
    const risks = normalizeQuestionnaireRiskCodes(event.dotaznik.rizika);
    const important = event.dotaznik.pozadovan_vyjezd_technika || event.dotaznik.stav === "pozadovan_vyjezd_technika";

    return (
      <article
        className={[
          "rounded-2xl border p-4",
          important ? "border-red-500/50 bg-red-950/20" : "border-amber-500/30 bg-amber-950/20",
        ].join(" ")}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className={important ? "text-xs font-black uppercase tracking-wide text-red-200" : "text-xs font-black uppercase tracking-wide text-amber-200"}>
              Klientský dotazník
            </div>
            <div className="mt-1 font-black text-white">{getDotaznikStatusLabel(event.dotaznik)}</div>
            {event.zakazka ? (
              <Link
                href={`/zakazky/${event.zakazka.zakazka_id}`}
                className="mt-1 inline-flex text-xs font-semibold text-blue-200 hover:text-blue-100 hover:underline"
              >
                {getZakazkaTitle(event.zakazka)}
              </Link>
            ) : null}
          </div>
          <div className="text-xs text-slate-400">{formatDateTime(event.date)}</div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
          <span className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-slate-300">
            {event.photoCount} fotek v dotazníku
          </span>
          {important ? (
            <span className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-1 text-red-100">
              Výjezd technika
            </span>
          ) : null}
        </div>

        {risks.length > 0 ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {risks.map((risk) => (
              <div key={risk} className="rounded-xl border border-amber-500/20 bg-slate-950/50 px-3 py-2 text-xs text-amber-100">
                {getQuestionnaireRiskLabel(risk)}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 px-3 py-2 text-xs text-emerald-100">
            Klient neuvedl žádná technická upozornění.
          </div>
        )}
      </article>
    );
  }

  if (event.type === "poznamka") {
    return (
      <article
        className={[
          "rounded-2xl border p-4",
          event.note.dulezite ? "border-amber-500/50 bg-amber-950/20" : "border-slate-800 bg-slate-950/60",
        ].join(" ")}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-400">Interní poznámka</div>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="rounded-lg border border-blue-500/30 bg-blue-950/30 px-3 py-1 text-xs font-black text-blue-100">
                {formatNoteType(event.note.typ)}
              </span>
              {event.note.dulezite ? (
                <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1 text-xs font-black text-amber-100">
                  Důležité
                </span>
              ) : null}
            </div>
          </div>
          <div className="text-xs text-slate-400">{formatDateTime(event.date)}</div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{event.note.text}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>Autor: {getAuthorLabel(event.author)}</span>
          {event.note.zakazka_id ? (
            <Link href={`/zakazky/${event.note.zakazka_id}`} className="font-semibold text-blue-200 hover:text-blue-100 hover:underline">
              {getZakazkaTitle(event.zakazka, event.note.zakazka_id)}
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={[
        "rounded-2xl border p-4",
        event.photo.dulezite ? "border-amber-500/50 bg-amber-950/20" : "border-slate-800 bg-slate-950/60",
      ].join(" ")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-slate-400">Interní fotka</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <span className="rounded-lg border border-blue-500/30 bg-blue-950/30 px-3 py-1 text-xs font-black text-blue-100">
              {formatPhotoType(event.photo.typ)}
            </span>
            {event.photo.dulezite ? (
              <span className="rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-1 text-xs font-black text-amber-100">
                Důležité
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-xs text-slate-400">{formatDateTime(event.date)}</div>
      </div>
      {event.photo.popis ? (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-100">{event.photo.popis}</p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Bez popisu.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
        <span>Autor: {getAuthorLabel(event.author)}</span>
        {event.photo.zakazka_id ? (
          <Link href={`/zakazky/${event.photo.zakazka_id}`} className="font-semibold text-blue-200 hover:text-blue-100 hover:underline">
            {getZakazkaTitle(event.zakazka, event.photo.zakazka_id)}
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function PlaceTimelineCard({ events }: { events: TimelineEvent[] }) {
  const groups = groupTimelineEvents(events);

  return (
    <Card className="mt-6 border-slate-700 bg-[#0b1324]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Historie místa</h2>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
            Praktická provozní paměť místa: zakázky, klientská upozornění, interní poznámky a fotky v čase.
          </p>
        </div>
        <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-sm">
          <div className="text-xs uppercase tracking-wide text-blue-200">Události</div>
          <div className="mt-1 text-lg font-black text-white">{events.length}</div>
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 px-4 py-5 text-sm text-slate-400">
          K tomuto místu zatím není provozní historie.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {groups.map((group) => (
            <section key={group.day} className="relative pl-4">
              <div className="absolute bottom-0 left-0 top-2 w-px bg-slate-800" />
              <div className="absolute left-[-3px] top-2 h-2 w-2 rounded-full bg-blue-400" />
              <h3 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-300">
                {formatTimelineDay(group.day)}
              </h3>
              <div className="space-y-3">
                {group.items.map((event) => (
                  <TimelineEventCard key={event.id} event={event} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}

export default async function MistoDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: mistoRaw, error: mistoError } = await supabase
    .from("mista_konani")
    .select("misto_id, nazev, adresa_text")
    .eq("misto_id", id)
    .maybeSingle();

  if (mistoError) {
    return <div>Chyba místa konání: {mistoError.message}</div>;
  }

  const misto = (mistoRaw ?? null) as MistoKonaniRow | null;
  if (!misto) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <h1 className="text-2xl font-black text-white">Místo konání nenalezeno</h1>
          <p className="mt-2 text-sm text-slate-400">Požadované místo neexistuje nebo k němu nemáte přístup.</p>
          <Link
            href="/zakazky"
            className="mt-4 inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
          >
            Zpět na zakázky
          </Link>
        </Card>
      </div>
    );
  }

  const { data: zakazkyRaw, error: zakazkyError } = await supabase
    .from("zakazky")
    .select("zakazka_id, cislo_zakazky, nazev, akce_od, datum_od, zrusena")
    .eq("misto_id", id)
    .order("akce_od", { ascending: false, nullsFirst: false })
    .order("datum_od", { ascending: false, nullsFirst: false });

  if (zakazkyError) {
    return <div>Chyba zakázek místa: {zakazkyError.message}</div>;
  }

  const zakazky = (zakazkyRaw ?? []) as PlaceZakazkaRow[];
  const zakazkaIds = zakazky.map((zakazka) => zakazka.zakazka_id);
  const zakazkyById = new Map<string, PlaceTechnicalNoteZakazkaRow>(
    zakazky.map((zakazka) => [
      zakazka.zakazka_id,
      {
        zakazka_id: zakazka.zakazka_id,
        cislo_zakazky: zakazka.cislo_zakazky,
        nazev: zakazka.nazev,
      },
    ])
  );
  const timelineZakazkyById = new Map(zakazky.map((zakazka) => [zakazka.zakazka_id, zakazka]));

  const { data: notesRaw, error: notesError } = await supabase
    .from("misto_technicke_poznamky")
    .select("id, misto_id, zakazka_id, autor_id, typ, text, dulezite, created_at, updated_at")
    .eq("misto_id", id)
    .order("dulezite", { ascending: false })
    .order("created_at", { ascending: false });

  if (notesError) {
    return <div>Chyba technických poznámek místa: {notesError.message}</div>;
  }

  const notes = (notesRaw ?? []) as PlaceTechnicalNoteRow[];

  const { data: photosRaw, error: photosError } = await supabase
    .from("misto_technicke_fotky")
    .select("id, misto_id, zakazka_id, autor_id, storage_bucket, storage_path, typ, popis, dulezite, original_filename, mime_type, size_bytes, created_at")
    .eq("misto_id", id)
    .order("dulezite", { ascending: false })
    .order("created_at", { ascending: false });

  if (photosError) {
    return <div>Chyba technických fotek místa: {photosError.message}</div>;
  }

  const photos = (photosRaw ?? []) as PlaceTechnicalPhotoRow[];

  let dotazniky: PlaceDotaznikRow[] = [];
  let dotaznikPhotoCounts = new Map<string, number>();
  if (zakazkaIds.length > 0) {
    const { data: dotaznikyRaw, error: dotaznikyError } = await supabase
      .from("zakazka_dotazniky")
      .select("dotaznik_id, zakazka_id, stav, pozadovan_vyjezd_technika, rizika, submitted_at, updated_at")
      .in("zakazka_id", zakazkaIds)
      .not("submitted_at", "is", null)
      .order("submitted_at", { ascending: false });

    if (dotaznikyError) {
      return <div>Chyba dotazníků místa: {dotaznikyError.message}</div>;
    }

    dotazniky = (dotaznikyRaw ?? []) as PlaceDotaznikRow[];
    const dotaznikIds = dotazniky.map((dotaznik) => dotaznik.dotaznik_id);

    if (dotaznikIds.length > 0) {
      const { data: dotaznikPhotosRaw, error: dotaznikPhotosError } = await supabase
        .from("dotaznik_fotky")
        .select("dotaznik_odpoved_id")
        .in("dotaznik_odpoved_id", dotaznikIds);

      if (dotaznikPhotosError) {
        return <div>Chyba počtu fotek dotazníků: {dotaznikPhotosError.message}</div>;
      }

      for (const row of (dotaznikPhotosRaw ?? []) as DotaznikPhotoCountRow[]) {
        if (!row.dotaznik_odpoved_id) continue;
        dotaznikPhotoCounts.set(
          row.dotaznik_odpoved_id,
          (dotaznikPhotoCounts.get(row.dotaznik_odpoved_id) ?? 0) + 1
        );
      }
    }
  }

  const authorIds = [
    ...new Set([
      ...notes.map((note) => note.autor_id).filter(Boolean),
      ...photos.map((photo) => photo.autor_id).filter(Boolean),
    ]),
  ] as string[];
  let authorsById = new Map<string, PlaceTechnicalNoteAuthorRow>();

  if (authorIds.length > 0) {
    const { data: authorsRaw, error: authorsError } = await supabase
      .from("profiles")
      .select("user_id, email, jmeno, prijmeni")
      .in("user_id", authorIds);

    if (authorsError) {
      return <div>Chyba autorů poznámek: {authorsError.message}</div>;
    }

    authorsById = new Map(
      ((authorsRaw ?? []) as PlaceTechnicalNoteAuthorRow[]).map((author) => [author.user_id, author])
    );
  }

  const linkedZakazkaIds = [
    ...new Set([
      ...notes.map((note) => note.zakazka_id).filter(Boolean),
      ...photos.map((photo) => photo.zakazka_id).filter(Boolean),
    ]),
  ] as string[];
  const missingLinkedZakazkaIds = linkedZakazkaIds.filter((zakazkaId) => !zakazkyById.has(zakazkaId));

  if (missingLinkedZakazkaIds.length > 0) {
    const { data: linkedZakazkyRaw, error: linkedZakazkyError } = await supabase
      .from("zakazky")
      .select("zakazka_id, cislo_zakazky, nazev")
      .in("zakazka_id", missingLinkedZakazkaIds);

    if (linkedZakazkyError) {
      return <div>Chyba vazeb poznámek na zakázky: {linkedZakazkyError.message}</div>;
    }

    for (const zakazka of (linkedZakazkyRaw ?? []) as PlaceTechnicalNoteZakazkaRow[]) {
      zakazkyById.set(zakazka.zakazka_id, zakazka);
    }
  }

  const adminSupabase = createAdminClient();
  const photoGalleryItems: PlaceTechnicalPhotoGalleryItem[] = await Promise.all(
    photos.map(async (photo) => {
      const { data: signedUrlData } = await adminSupabase.storage
        .from(photo.storage_bucket)
        .createSignedUrl(photo.storage_path, 60 * 60);

      return {
        id: photo.id,
        signedUrl: signedUrlData?.signedUrl ?? null,
        typ: photo.typ,
        popis: photo.popis,
        dulezite: photo.dulezite,
        originalFilename: photo.original_filename,
        createdAt: photo.created_at,
        authorLabel: getAuthorLabel(photo.autor_id ? authorsById.get(photo.autor_id) : undefined),
        zakazkaId: photo.zakazka_id,
        zakazkaLabel: getZakazkaLabel(
          photo.zakazka_id ? zakazkyById.get(photo.zakazka_id) : undefined,
          photo.zakazka_id
        ),
      };
    })
  );

  const timelineEvents: TimelineEvent[] = [];

  for (const zakazka of zakazky) {
    const date = zakazka.akce_od ?? zakazka.datum_od;
    if (!date) continue;

    timelineEvents.push({
      id: `zakazka-${zakazka.zakazka_id}`,
      type: "zakazka",
      date,
      zakazka,
    });
  }

  for (const dotaznik of dotazniky) {
    const date = dotaznik.submitted_at ?? dotaznik.updated_at;
    if (!date) continue;

    timelineEvents.push({
      id: `dotaznik-${dotaznik.dotaznik_id}`,
      type: "dotaznik",
      date,
      dotaznik,
      zakazka: timelineZakazkyById.get(dotaznik.zakazka_id),
      photoCount: dotaznikPhotoCounts.get(dotaznik.dotaznik_id) ?? 0,
    });
  }

  for (const note of notes) {
    if (!note.created_at) continue;

    timelineEvents.push({
      id: `poznamka-${note.id}`,
      type: "poznamka",
      date: note.created_at,
      note,
      author: note.autor_id ? authorsById.get(note.autor_id) : undefined,
      zakazka: note.zakazka_id ? zakazkyById.get(note.zakazka_id) : undefined,
    });
  }

  for (const photo of photos) {
    if (!photo.created_at) continue;

    timelineEvents.push({
      id: `fotka-${photo.id}`,
      type: "fotka",
      date: photo.created_at,
      photo,
      author: photo.autor_id ? authorsById.get(photo.autor_id) : undefined,
      zakazka: photo.zakazka_id ? zakazkyById.get(photo.zakazka_id) : undefined,
    });
  }

  timelineEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="w-full">
      <div className="mb-4">
        <Link
          href="/mista"
          className="inline-flex rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-800"
        >
          Zpět na místa
        </Link>
      </div>

      <Card className="border-slate-700 bg-[#0b1324]">
        <div className="text-xs font-semibold uppercase tracking-wide text-blue-300">Místo konání</div>
        <h1 className="mt-2 text-3xl font-black text-white">{misto.nazev ?? "Místo konání"}</h1>
        {misto.adresa_text ? <p className="mt-2 text-sm text-slate-300">{misto.adresa_text}</p> : null}
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
          Tato stránka slouží pro interní technické know-how místa. Data z klientských dotazníků se sem
          nepřepisují automaticky.
        </p>
      </Card>

      <PlaceTimelineCard events={timelineEvents} />

      <PlaceTechnicalNotesCard
        misto={misto}
        notes={notes}
        authorsById={authorsById}
        zakazkyById={zakazkyById}
      />

      <Card className="mt-6 space-y-5 border-slate-700 bg-[#0b1324]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Interní technické fotky místa</h2>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">
              Dlouhodobé obrazové know-how firmy k místu. Fotky jsou oddělené od klientských dotazníků
              a načítají se přes krátkodobé signed URL.
            </p>
          </div>
          <div className="rounded-xl border border-blue-500/40 bg-blue-950/30 px-4 py-3 text-sm">
            <div className="text-xs uppercase tracking-wide text-blue-200">Fotky</div>
            <div className="mt-1 text-lg font-black text-white">{photos.length}</div>
          </div>
        </div>

        <PlaceTechnicalPhotoUpload mistoId={misto.misto_id} />
        <PlaceTechnicalPhotoGallery photos={photoGalleryItems} />
      </Card>
    </div>
  );
}
