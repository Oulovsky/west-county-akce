import type { PoptavkaStav } from "@/lib/client-portal/types";
import {
  INTERNAL_ACTIVE_POPTAVKA_STAVY,
  INTERNAL_INBOX_POPTAVKA_STAVY,
  INTERNAL_REJECTED_POPTAVKA_STAVY,
} from "@/lib/client-portal/types";

export type PoptavkaInboxVisibility = {
  shownInInternalInbox: boolean;
  inboxTab: "active" | "rejected" | null;
  summary: string;
};

export type ClientPoptavkaCounts = {
  total: number;
  inbox: number;
  outsideInbox: number;
  koncept: number;
  legacy: number;
  otherOutside: number;
};

const ACTIVE_SET = new Set<string>(INTERNAL_ACTIVE_POPTAVKA_STAVY);
const REJECTED_SET = new Set<string>(INTERNAL_REJECTED_POPTAVKA_STAVY);
const INBOX_SET = new Set<string>(INTERNAL_INBOX_POPTAVKA_STAVY);

const EMPTY_COUNTS: ClientPoptavkaCounts = {
  total: 0,
  inbox: 0,
  outsideInbox: 0,
  koncept: 0,
  legacy: 0,
  otherOutside: 0,
};

/** Stejná logika jako filtr v /zakazky/poptavky (aktivní + odmítnuté záložky). */
export function isPoptavkaVisibleInInternalInbox(stav: string): boolean {
  return INBOX_SET.has(stav);
}

/** Krátké vysvětlení viditelnosti pro admin UI. */
export function getPoptavkaVisibilityReason(stav: string): string {
  if (stav === "koncept") {
    return "Koncept — klient zatím neodeslal";
  }

  if (stav === "ceka_na_schvaleni") {
    return "Legacy stav — nezobrazuje se v aktuálním inboxu";
  }

  if (REJECTED_SET.has(stav)) {
    return "Zamítnutá — je v záložce Odmítnuté";
  }

  if (ACTIVE_SET.has(stav)) {
    return "Viditelná v interním inboxu (záložka Aktuální)";
  }

  return `Stav „${stav}“ — nezobrazuje se v interním inboxu`;
}

export function splitClientPoptavkaCounts(
  poptavky: Array<{ stav: string }>
): ClientPoptavkaCounts {
  if (poptavky.length === 0) {
    return { ...EMPTY_COUNTS };
  }

  let inbox = 0;
  let koncept = 0;
  let legacy = 0;
  let otherOutside = 0;

  for (const row of poptavky) {
    if (isPoptavkaVisibleInInternalInbox(row.stav)) {
      inbox += 1;
      continue;
    }

    if (row.stav === "koncept") {
      koncept += 1;
    } else if (row.stav === "ceka_na_schvaleni") {
      legacy += 1;
    } else {
      otherOutside += 1;
    }
  }

  const total = poptavky.length;

  return {
    total,
    inbox,
    outsideInbox: total - inbox,
    koncept,
    legacy,
    otherOutside,
  };
}

function konceptLabel(count: number): string {
  if (count === 1) return "koncept";
  if (count >= 2 && count <= 4) return "koncepty";
  return "konceptů";
}

function legacyLabel(count: number): string {
  if (count === 1) return "legacy";
  return "legacy";
}

function mimoInboxLabel(count: number): string {
  if (count === 1) return "mimo inbox";
  return "mimo inbox";
}

/** Druhý řádek rozpadu pro /admin/klienti, např. „0 v inboxu · 1 koncept“. */
export function formatClientPoptavkaCountsSecondary(counts: ClientPoptavkaCounts): string {
  if (counts.total === 0) {
    return "";
  }

  const parts = [`${counts.inbox} v inboxu`];

  if (counts.koncept > 0) {
    parts.push(`${counts.koncept} ${konceptLabel(counts.koncept)}`);
  }

  if (counts.legacy > 0) {
    parts.push(`${counts.legacy} ${legacyLabel(counts.legacy)}`);
  }

  if (counts.otherOutside > 0) {
    parts.push(`${counts.otherOutside} ${mimoInboxLabel(counts.otherOutside)}`);
  }

  return parts.join(" · ");
}

/** Kompaktní varianta: „1 (0 inbox / 1 koncept)“. */
export function formatClientPoptavkaCountsCompact(counts: ClientPoptavkaCounts): string {
  if (counts.total === 0) {
    return "0";
  }

  const outsideParts: string[] = [];
  if (counts.koncept > 0) {
    outsideParts.push(`${counts.koncept} ${konceptLabel(counts.koncept)}`);
  }
  if (counts.legacy > 0) {
    outsideParts.push(`${counts.legacy} ${legacyLabel(counts.legacy)}`);
  }
  if (counts.otherOutside > 0) {
    outsideParts.push(`${counts.otherOutside} ${mimoInboxLabel(counts.otherOutside)}`);
  }

  const outsideText =
    outsideParts.length > 0 ? outsideParts.join(" + ") : `${counts.outsideInbox} mimo inbox`;

  return `${counts.total} (${counts.inbox} inbox / ${outsideText})`;
}

/** Vysvětlení, proč poptávka je / není v /zakazky/poptavky. */
export function getPoptavkaInboxVisibility(
  stav: string,
  odeslanoAt: string | null | undefined
): PoptavkaInboxVisibility {
  const shownInInternalInbox = isPoptavkaVisibleInInternalInbox(stav);
  const reason = getPoptavkaVisibilityReason(stav);

  let inboxTab: "active" | "rejected" | null = null;
  if (REJECTED_SET.has(stav)) {
    inboxTab = "rejected";
  } else if (ACTIVE_SET.has(stav)) {
    inboxTab = "active";
  }

  let summary = reason;

  if (shownInInternalInbox && inboxTab === "active") {
    const submittedNote = odeslanoAt
      ? ` Odesláno ${new Date(odeslanoAt).toLocaleString("cs-CZ")}.`
      : " Bez data odeslání — ověřte historii.";
    summary = `${reason}.${submittedNote}`;
  } else if (shownInInternalInbox && inboxTab === "rejected") {
    summary = `${reason}. Zobrazeno v /zakazky/poptavky.`;
  } else if (!shownInInternalInbox) {
    summary = `${reason}. V /zakazky/poptavky se nezobrazuje.`;
  }

  return {
    shownInInternalInbox,
    inboxTab,
    summary,
  };
}

export function canResendPoptavkaSubmittedConfirmation(stav: PoptavkaStav): boolean {
  return (
    stav === "odeslana" ||
    stav === "v_revizi" ||
    stav === "prijata_k_reseni" ||
    stav === "schvalena" ||
    stav === "prevadena_do_zakazky" ||
    stav === "objednavka_odeslana" ||
    stav === "objednavka_potvrzena" ||
    stav === "objednavka_odmitnuta" ||
    stav === "zamitnuta"
  );
}

export function canAdminReleaseKonceptToInbox(stav: PoptavkaStav): boolean {
  return stav === "koncept";
}
