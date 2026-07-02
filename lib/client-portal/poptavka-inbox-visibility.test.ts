import { describe, expect, it } from "vitest";
import {
  formatClientPoptavkaCountsCompact,
  formatClientPoptavkaCountsSecondary,
  getPoptavkaVisibilityReason,
  isPoptavkaVisibleInInternalInbox,
  splitClientPoptavkaCounts,
} from "@/lib/client-portal/poptavka-inbox-visibility";
import {
  INTERNAL_ACTIVE_POPTAVKA_STAVY,
  INTERNAL_INBOX_POPTAVKA_STAVY,
  INTERNAL_REJECTED_POPTAVKA_STAVY,
} from "@/lib/client-portal/types";

describe("isPoptavkaVisibleInInternalInbox", () => {
  it.each([
    "odeslana",
    "prijata_k_reseni",
    "objednavka_odeslana",
    "objednavka_odmitnuta",
  ] as const)("vrací true pro aktivní stav %s", (stav) => {
    expect(isPoptavkaVisibleInInternalInbox(stav)).toBe(true);
    expect(INTERNAL_INBOX_POPTAVKA_STAVY).toContain(stav);
  });

  it("prevadena_do_zakazky odpovídá INTERNAL_INBOX_POPTAVKA_STAVY", () => {
    const inInbox = INTERNAL_INBOX_POPTAVKA_STAVY.includes("prevadena_do_zakazky");
    expect(isPoptavkaVisibleInInternalInbox("prevadena_do_zakazky")).toBe(inInbox);
    expect(inInbox).toBe(true);
  });

  it("vrací false pro koncept", () => {
    expect(isPoptavkaVisibleInInternalInbox("koncept")).toBe(false);
  });

  it("vrací false pro ceka_na_schvaleni", () => {
    expect(isPoptavkaVisibleInInternalInbox("ceka_na_schvaleni")).toBe(false);
  });

  it("zamitnuta je viditelná podle záložky Odmítnuté", () => {
    expect(INTERNAL_REJECTED_POPTAVKA_STAVY).toContain("zamitnuta");
    expect(isPoptavkaVisibleInInternalInbox("zamitnuta")).toBe(true);
  });

  it("všechny aktivní stavy z konstanty jsou viditelné", () => {
    for (const stav of INTERNAL_ACTIVE_POPTAVKA_STAVY) {
      expect(isPoptavkaVisibleInInternalInbox(stav)).toBe(true);
    }
  });

  it("všechny stavy interního inboxu jsou viditelné", () => {
    for (const stav of INTERNAL_INBOX_POPTAVKA_STAVY) {
      expect(isPoptavkaVisibleInInternalInbox(stav)).toBe(true);
    }
  });
});

describe("getPoptavkaVisibilityReason", () => {
  it("koncept vysvětluje, že klient zatím neodeslal", () => {
    expect(getPoptavkaVisibilityReason("koncept")).toBe(
      "Koncept — klient zatím neodeslal"
    );
  });

  it("ceka_na_schvaleni vysvětluje legacy stav mimo inbox", () => {
    expect(getPoptavkaVisibilityReason("ceka_na_schvaleni")).toBe(
      "Legacy stav — nezobrazuje se v aktuálním inboxu"
    );
  });

  it("zamitnuta vysvětluje záložku Odmítnuté", () => {
    expect(getPoptavkaVisibilityReason("zamitnuta")).toBe(
      "Zamítnutá — je v záložce Odmítnuté"
    );
  });

  it("aktivní stav vysvětluje viditelnost v interním inboxu", () => {
    expect(getPoptavkaVisibilityReason("odeslana")).toBe(
      "Viditelná v interním inboxu (záložka Aktuální)"
    );
    expect(getPoptavkaVisibilityReason("prijata_k_reseni")).toContain(
      "interním inboxu"
    );
  });

  it("neznámý stav vrací obecné vysvětlení mimo inbox", () => {
    expect(getPoptavkaVisibilityReason("neexistujici_stav")).toBe(
      "Stav „neexistujici_stav“ — nezobrazuje se v interním inboxu"
    );
  });
});

describe("splitClientPoptavkaCounts", () => {
  it("prázdné pole vrací nulové počty", () => {
    expect(splitClientPoptavkaCounts([])).toEqual({
      total: 0,
      inbox: 0,
      outsideInbox: 0,
      koncept: 0,
      legacy: 0,
      otherOutside: 0,
    });
  });

  it("počítá pouze koncept", () => {
    expect(splitClientPoptavkaCounts([{ stav: "koncept" }])).toEqual({
      total: 1,
      inbox: 0,
      outsideInbox: 1,
      koncept: 1,
      legacy: 0,
      otherOutside: 0,
    });
  });

  it("počítá pouze inbox stav", () => {
    expect(splitClientPoptavkaCounts([{ stav: "odeslana" }])).toEqual({
      total: 1,
      inbox: 1,
      outsideInbox: 0,
      koncept: 0,
      legacy: 0,
      otherOutside: 0,
    });
  });

  it("počítá kombinaci koncept + odeslana + legacy", () => {
    expect(
      splitClientPoptavkaCounts([
        { stav: "koncept" },
        { stav: "odeslana" },
        { stav: "ceka_na_schvaleni" },
      ])
    ).toEqual({
      total: 3,
      inbox: 1,
      outsideInbox: 2,
      koncept: 1,
      legacy: 1,
      otherOutside: 0,
    });
  });

  it("počítá otherOutside pro neznámý stav mimo inbox", () => {
    expect(
      splitClientPoptavkaCounts([{ stav: "neexistujici_stav" }])
    ).toEqual({
      total: 1,
      inbox: 0,
      outsideInbox: 1,
      koncept: 0,
      legacy: 0,
      otherOutside: 1,
    });
  });
});

describe("formatClientPoptavkaCountsSecondary / Compact", () => {
  const prchalCounts = splitClientPoptavkaCounts([{ stav: "koncept" }]);

  it("Prchal scénář: 1 celkem, 0 inbox, 1 koncept", () => {
    expect(prchalCounts).toEqual({
      total: 1,
      inbox: 0,
      outsideInbox: 1,
      koncept: 1,
      legacy: 0,
      otherOutside: 0,
    });
    expect(formatClientPoptavkaCountsSecondary(prchalCounts)).toBe(
      "0 v inboxu · 1 koncept"
    );
    expect(formatClientPoptavkaCountsCompact(prchalCounts)).toBe(
      "1 (0 inbox / 1 koncept)"
    );
  });

  it("prázdný počet vrací prázdný secondary a „0“ v compact", () => {
    const empty = splitClientPoptavkaCounts([]);
    expect(formatClientPoptavkaCountsSecondary(empty)).toBe("");
    expect(formatClientPoptavkaCountsCompact(empty)).toBe("0");
  });

  it("pouze inbox stav bez mimo-inbox částí", () => {
    const counts = splitClientPoptavkaCounts([{ stav: "odeslana" }]);
    expect(formatClientPoptavkaCountsSecondary(counts)).toBe("1 v inboxu");
    expect(formatClientPoptavkaCountsCompact(counts)).toBe("1 (1 inbox / 0 mimo inbox)");
  });

  it("kombinace více mimo-inbox kategorií", () => {
    const counts = splitClientPoptavkaCounts([
      { stav: "koncept" },
      { stav: "ceka_na_schvaleni" },
      { stav: "odeslana" },
    ]);
    expect(formatClientPoptavkaCountsSecondary(counts)).toBe(
      "1 v inboxu · 1 koncept · 1 legacy"
    );
    expect(formatClientPoptavkaCountsCompact(counts)).toBe(
      "3 (1 inbox / 1 koncept + 1 legacy)"
    );
  });
});
