import type { PoptavkaStav } from "@/lib/client-portal/types";
import {
  INTERNAL_ACTIVE_POPTAVKA_STAVY,
  INTERNAL_REJECTED_POPTAVKA_STAVY,
} from "@/lib/client-portal/types";

export type PoptavkaInboxVisibility = {
  shownInInternalInbox: boolean;
  inboxTab: "active" | "rejected" | null;
  summary: string;
};

const ACTIVE_SET = new Set<string>(INTERNAL_ACTIVE_POPTAVKA_STAVY);
const REJECTED_SET = new Set<string>(INTERNAL_REJECTED_POPTAVKA_STAVY);

/** Vysvětlení, proč poptávka je / není v /zakazky/poptavky. */
export function getPoptavkaInboxVisibility(
  stav: string,
  odeslanoAt: string | null | undefined
): PoptavkaInboxVisibility {
  if (stav === "koncept") {
    return {
      shownInInternalInbox: false,
      inboxTab: null,
      summary:
        "Koncept — klient poptávku neodeslal. V /zakazky/poptavky se nezobrazuje (admin/klienti počítá všechny řádky včetně konceptů).",
    };
  }

  if (stav === "ceka_na_schvaleni") {
    return {
      shownInInternalInbox: false,
      inboxTab: null,
      summary:
        "Legacy stav „čeká na schválení“ — mimo filtr interního inboxu. Zkontrolujte, zda nemá být „odeslana“.",
    };
  }

  if (REJECTED_SET.has(stav)) {
    return {
      shownInInternalInbox: true,
      inboxTab: "rejected",
      summary: "Zobrazeno v /zakazky/poptavky → záložka Odmítnuté.",
    };
  }

  if (ACTIVE_SET.has(stav)) {
    const submittedNote = odeslanoAt
      ? ` Odesláno ${new Date(odeslanoAt).toLocaleString("cs-CZ")}.`
      : " Bez data odeslání — ověřte historii.";
    return {
      shownInInternalInbox: true,
      inboxTab: "active",
      summary: `Zobrazeno v /zakazky/poptavky → záložka Aktuální.${submittedNote}`,
    };
  }

  return {
    shownInInternalInbox: false,
    inboxTab: null,
    summary: `Stav „${stav}“ není v interním inboxu.`,
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
