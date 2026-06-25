import { combineDateAndTime } from "@/app/zakazky/[id]/helpers";

export type LogistikaOknoValues = {
  stavba_okno_od: string;
  stavba_okno_do: string;
  bourani_okno_od: string;
  bourani_okno_do: string;
  logistika_poznamka_klienta: string;
};

export const EMPTY_LOGISTIKA_OKNA: LogistikaOknoValues = {
  stavba_okno_od: "",
  stavba_okno_do: "",
  bourani_okno_od: "",
  bourani_okno_do: "",
  logistika_poznamka_klienta: "",
};

export function emptyLogistikaOknaValues(): LogistikaOknoValues {
  return { ...EMPTY_LOGISTIKA_OKNA };
}

/** datetime-local → ISO bez timezone offsetu (stejný formát jako combineDateAndTime). */
export function parseDatetimeLocalToIso(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed}:00`;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}:00`;
}

export function toDatetimeLocalInput(value: string | null | undefined): string {
  if (!value?.trim()) return "";
  const trimmed = value.trim();
  if (trimmed.length >= 16) {
    return trimmed.slice(0, 16);
  }
  return trimmed;
}

export function formatLogistikaOknoRange(
  od: string | null | undefined,
  doValue: string | null | undefined
): string | null {
  const fromText = formatLogistikaOknoPoint(od);
  const toText = formatLogistikaOknoPoint(doValue);
  if (!fromText && !toText) return null;
  if (fromText && toText) return `${fromText} – ${toText}`;
  if (fromText) return `od ${fromText}`;
  return `do ${toText}`;
}

export function formatLogistikaOknoPoint(value: string | null | undefined): string | null {
  if (!value?.trim()) return null;
  const date = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("cs-CZ", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function validateLogistikaOknoPair(
  od: string | null | undefined,
  doValue: string | null | undefined
): string | null {
  const odTrimmed = od?.trim() ?? "";
  const doTrimmed = doValue?.trim() ?? "";
  if (!odTrimmed && !doTrimmed) return null;
  if (odTrimmed && !doTrimmed) return null;
  if (!odTrimmed && doTrimmed) return null;
  const start = new Date(odTrimmed).getTime();
  const end = new Date(doTrimmed).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return "Neplatný formát data a času.";
  }
  if (end <= start) {
    return "Konec okna musí být po začátku okna.";
  }
  return null;
}

export function validateLogistikaOkna(values: LogistikaOknoValues): string | null {
  const stavbaError = validateLogistikaOknoPair(values.stavba_okno_od, values.stavba_okno_do);
  if (stavbaError) return `Stavba: ${stavbaError}`;
  const bouraniError = validateLogistikaOknoPair(values.bourani_okno_od, values.bourani_okno_do);
  if (bouraniError) return `Bourání: ${bouraniError}`;
  return null;
}

export function parseLogistikaOknaFromFormData(formData: FormData): LogistikaOknoValues {
  return {
    stavba_okno_od: String(formData.get("stavba_okno_od") ?? "").trim(),
    stavba_okno_do: String(formData.get("stavba_okno_do") ?? "").trim(),
    bourani_okno_od: String(formData.get("bourani_okno_od") ?? "").trim(),
    bourani_okno_do: String(formData.get("bourani_okno_do") ?? "").trim(),
    logistika_poznamka_klienta: String(formData.get("logistika_poznamka_klienta") ?? "").trim(),
  };
}

export function buildLogistikaOknaRowPayload(values: LogistikaOknoValues) {
  const nullable = (value: string) => value.trim() || null;
  return {
    stavba_okno_od: parseDatetimeLocalToIso(values.stavba_okno_od),
    stavba_okno_do: parseDatetimeLocalToIso(values.stavba_okno_do),
    bourani_okno_od: parseDatetimeLocalToIso(values.bourani_okno_od),
    bourani_okno_do: parseDatetimeLocalToIso(values.bourani_okno_do),
    logistika_poznamka_klienta: nullable(values.logistika_poznamka_klienta),
  };
}

export function logistikaOknaFromPoptavka(row: {
  stavba_okno_od?: string | null;
  stavba_okno_do?: string | null;
  bourani_okno_od?: string | null;
  bourani_okno_do?: string | null;
  logistika_poznamka_klienta?: string | null;
  stavba_datum?: string | null;
  stavba_cas_od?: string | null;
  stavba_cas_do?: string | null;
  bourani_datum?: string | null;
  bourani_cas_od?: string | null;
  bourani_cas_do?: string | null;
}): LogistikaOknoValues {
  const stavbaOd =
    row.stavba_okno_od ??
    combineDateAndTime(row.stavba_datum, row.stavba_cas_od?.slice(0, 5) ?? null);
  const stavbaDo =
    row.stavba_okno_do ??
    combineDateAndTime(row.stavba_datum, row.stavba_cas_do?.slice(0, 5) ?? null);
  const bouraniOd =
    row.bourani_okno_od ??
    combineDateAndTime(row.bourani_datum, row.bourani_cas_od?.slice(0, 5) ?? null);
  const bouraniDo =
    row.bourani_okno_do ??
    combineDateAndTime(row.bourani_datum, row.bourani_cas_do?.slice(0, 5) ?? null);

  return {
    stavba_okno_od: toDatetimeLocalInput(stavbaOd),
    stavba_okno_do: toDatetimeLocalInput(stavbaDo),
    bourani_okno_od: toDatetimeLocalInput(bouraniOd),
    bourani_okno_do: toDatetimeLocalInput(bouraniDo),
    logistika_poznamka_klienta: row.logistika_poznamka_klienta?.trim() ?? "",
  };
}

export type ZakazkaRealizaceFields = {
  stavba_od?: string | null;
  stavba_do?: string | null;
  bourani_od?: string | null;
  bourani_do?: string | null;
  akce_od?: string | null;
  akce_do?: string | null;
};

export function hasZakazkaRealizaceStavba(zakazka: ZakazkaRealizaceFields): boolean {
  return Boolean(zakazka.stavba_od?.trim());
}

export function hasZakazkaRealizaceBourani(zakazka: ZakazkaRealizaceFields): boolean {
  return Boolean(zakazka.bourani_od?.trim());
}

export function getTerminRealizaceRange(termin: {
  realizaceOd?: string | null;
  realizaceDo?: string | null;
  datum?: string | null;
  casOd?: string | null;
  casDo?: string | null;
}): { od: string | null; do: string | null } {
  if (termin.realizaceOd?.trim()) {
    return {
      od: termin.realizaceOd.trim(),
      do: termin.realizaceDo?.trim() || null,
    };
  }

  const od = termin.datum
    ? combineDateAndTime(termin.datum, termin.casOd?.slice(0, 5) ?? null)
    : null;
  const doValue = termin.datum
    ? combineDateAndTime(termin.datum, termin.casDo?.slice(0, 5) ?? null)
    : null;

  return { od, do: doValue };
}

export function getTerminOknoRange(termin: {
  oknoOd?: string | null;
  oknoDo?: string | null;
}): { od: string | null; do: string | null } {
  return {
    od: termin.oknoOd?.trim() || null,
    do: termin.oknoDo?.trim() || null,
  };
}

export function formatLogistikaOknoLabel(prefix: string, od: string | null, doValue: string | null) {
  const range = formatLogistikaOknoRange(od, doValue);
  if (!range) return null;
  return `${prefix}: ${range}`;
}

export function getEmployeePhaseScheduleLabel(
  typBloku: string | null | undefined,
  assignment: { datum_od?: string | null; datum_do?: string | null },
  zakazka: ZakazkaRealizaceFields
): { text: string; pending: boolean } {
  const assignmentRange = formatLogistikaOknoRange(assignment.datum_od, assignment.datum_do);
  if (assignmentRange) {
    return { text: assignmentRange, pending: false };
  }

  const raw = String(typBloku ?? "").trim().toLowerCase();
  if (raw === "stavba") {
    const realizace = formatLogistikaOknoRange(zakazka.stavba_od, zakazka.stavba_do);
    if (realizace) return { text: realizace, pending: false };
    return { text: "Čas stavby bude upřesněn", pending: true };
  }
  if (raw === "bourani" || raw === "bourání") {
    const realizace = formatLogistikaOknoRange(zakazka.bourani_od, zakazka.bourani_do);
    if (realizace) return { text: realizace, pending: false };
    return { text: "Čas bourání bude upřesněn", pending: true };
  }

  const akceRealizace = formatLogistikaOknoRange(zakazka.akce_od, zakazka.akce_do);
  if (akceRealizace) return { text: akceRealizace, pending: false };

  return { text: "Čas není zadaný", pending: false };
}
