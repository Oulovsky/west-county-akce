"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  formatObjednavkaDateRange,
  formatObjednavkaTime,
} from "@/lib/client-portal/poptavka-objednavka-document";
import type { PortalPoptavkaObjednavkaDecisionView } from "@/lib/client-portal/poptavka-objednavka-link-server";
import type { PoptavkaStav } from "@/lib/client-portal/types";
import {
  confirmPoptavkaObjednavkaPortalAction,
  rejectPoptavkaObjednavkaPortalAction,
} from "@/app/portal/poptavka/[id]/objednavka-actions";

type DoneStatus = "confirmed" | "already_confirmed" | "rejected" | "already_rejected";

const DONE_MESSAGES: Record<DoneStatus, string> = {
  confirmed:
    "Závazná objednávka byla potvrzena. Děkujeme, nyní ji interně zpracujeme.",
  already_confirmed: "Objednávka už byla potvrzena.",
  rejected: "Závazná objednávka byla odmítnuta. Důvod jsme uložili a ozveme se.",
  already_rejected: "Objednávka už byla odmítnuta.",
};

function formatPortalDateTime(value: string | null | undefined) {
  if (!value) return null;
  return new Intl.DateTimeFormat("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function ObjednavkaSummary({
  view,
}: {
  view: PortalPoptavkaObjednavkaDecisionView;
}) {
  const { akce, misto } = view.snapshot;
  const datum = formatObjednavkaDateRange(akce.datumOd, akce.datumDo);
  const cas =
    akce.casProgramuOd && akce.casProgramuDo
      ? `${formatObjednavkaTime(akce.casProgramuOd)} – ${formatObjednavkaTime(akce.casProgramuDo)}`
      : formatObjednavkaTime(akce.casProgramuOd) ?? formatObjednavkaTime(akce.casProgramuDo);
  const termin = [datum, cas].filter(Boolean).join(", ") || null;

  return (
    <dl className="mt-3 grid gap-2 text-sm text-slate-300">
      {akce.nazevAkce ? (
        <div>
          <dt className="text-slate-500">Akce</dt>
          <dd className="text-slate-100">{akce.nazevAkce}</dd>
        </div>
      ) : null}
      {misto.nazev ? (
        <div>
          <dt className="text-slate-500">Místo</dt>
          <dd className="text-slate-100">{misto.nazev}</dd>
        </div>
      ) : null}
      {termin ? (
        <div>
          <dt className="text-slate-500">Termín</dt>
          <dd className="text-slate-100">{termin}</dd>
        </div>
      ) : null}
      {view.snapshot.textProKlienta.uvod?.trim() ? (
        <div>
          <dt className="text-slate-500">Poznámka</dt>
          <dd className="whitespace-pre-wrap text-slate-100">
            {view.snapshot.textProKlienta.uvod}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function PortalObjednavkaDecision({
  poptavkaId,
  canDecide,
}: {
  poptavkaId: string;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [reason, setReason] = useState("");
  const [doneStatus, setDoneStatus] = useState<DoneStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function finish(status: DoneStatus) {
    setDoneStatus(status);
    router.refresh();
  }

  function confirm() {
    if (isPending || !canDecide) return;

    if (
      !window.confirm(
        "Potvrzením souhlasíte se závaznou objednávkou v uvedeném rozsahu. Pokračovat?"
      )
    ) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await confirmPoptavkaObjednavkaPortalAction(poptavkaId);
      if (!result.ok) {
        setError(result.errorMessage);
        return;
      }

      finish(
        result.status === "already_confirmed" ? "already_confirmed" : "confirmed"
      );
    });
  }

  function reject() {
    if (isPending || !canDecide) return;
    setError(null);

    startTransition(async () => {
      const result = await rejectPoptavkaObjednavkaPortalAction(poptavkaId, reason);
      if (!result.ok) {
        setError(result.errorMessage);
        return;
      }

      finish(result.status === "already_rejected" ? "already_rejected" : "rejected");
    });
  }

  if (doneStatus) {
    const tone =
      doneStatus === "confirmed" || doneStatus === "already_confirmed"
        ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-100"
        : "border-amber-500/40 bg-amber-950/30 text-amber-100";

    return (
      <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${tone}`}>
        <p className="font-semibold">{DONE_MESSAGES[doneStatus]}</p>
      </div>
    );
  }

  if (!canDecide) {
    return (
      <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        Objednávku už nelze v portálu zpracovat (např. vypršela platnost). Kontaktujte prosím
        WEST COUNTY.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      <p className="text-sm text-slate-300">
        Potvrzením závazné objednávky souhlasíte s uvedeným rozsahem služeb a smluvními
        podmínkami. Pokud něco nesedí, objednávku můžete odmítnout.
      </p>

      {mode === "reject" ? (
        <div>
          <label className="text-sm font-semibold text-slate-200" htmlFor="portal-odmitnuti-duvod">
            Důvod odmítnutí
          </label>
          <p className="mt-1 text-xs text-slate-500">
            Důvod je volitelný, ale doporučujeme ho uvést — usnadní to další komunikaci.
          </p>
          <Textarea
            id="portal-odmitnuti-duvod"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            placeholder="Napište prosím, co je potřeba upravit nebo proč objednávku odmítáte."
            className="mt-2"
          />
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/30 px-3 py-2 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button type="button" onClick={confirm} disabled={isPending}>
          {isPending && mode === "idle" ? "Ukládám…" : "Potvrdit objednávku"}
        </Button>
        {mode === "reject" ? (
          <>
            <Button type="button" variant="danger" onClick={reject} disabled={isPending}>
              {isPending ? "Ukládám…" : "Odeslat odmítnutí"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMode("idle")}
              disabled={isPending}
            >
              Zpět
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="secondary"
            onClick={() => setMode("reject")}
            disabled={isPending}
          >
            Odmítnout objednávku
          </Button>
        )}
      </div>
    </div>
  );
}

export function PoptavkaObjednavkaPortalSection({
  poptavkaId,
  stav,
  view,
  potvrzenaAt,
  odmitnutaDuvod,
}: {
  poptavkaId: string;
  stav: PoptavkaStav;
  view: PortalPoptavkaObjednavkaDecisionView | null;
  potvrzenaAt: string | null;
  odmitnutaDuvod: string | null;
}) {
  const rejectReason = odmitnutaDuvod ?? view?.rejectReason ?? null;

  return (
    <section className="mb-6 rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-4">
      <h2 className="text-base font-semibold text-white">Závazná objednávka</h2>

      {stav === "objednavka_odeslana" ? (
        <>
          <p className="mt-2 text-sm text-blue-100">
            WEST COUNTY vám zaslala závaznou objednávku. Prosíme o potvrzení nebo odmítnutí níže.
          </p>
          {view ? (
            <>
              <ObjednavkaSummary view={view} />
              <PortalObjednavkaDecision poptavkaId={poptavkaId} canDecide={view.canDecide} />
            </>
          ) : (
            <p className="mt-3 text-sm text-amber-100">
              Obsah objednávky se nepodařilo načíst. Kontaktujte prosím WEST COUNTY.
            </p>
          )}
        </>
      ) : null}

      {stav === "objednavka_potvrzena" ? (
        <div className="mt-2 text-sm text-emerald-100">
          <p className="font-semibold">Objednávka potvrzena</p>
          <p className="mt-1">
            Závaznou objednávku jste potvrdili. WEST COUNTY nyní připravuje další kroky.
            {potvrzenaAt ? ` Potvrzeno ${formatPortalDateTime(potvrzenaAt)}.` : null}
          </p>
          {view ? <ObjednavkaSummary view={view} /> : null}
        </div>
      ) : null}

      {stav === "objednavka_odmitnuta" ? (
        <div className="mt-2 text-sm text-amber-100">
          <p className="font-semibold">Objednávka odmítnuta</p>
          {rejectReason ? (
            <p className="mt-2 whitespace-pre-wrap">{rejectReason}</p>
          ) : null}
          <p className="mt-3 text-amber-200/90">
            Pokud chcete pokračovat v jednání, kontaktujte WEST COUNTY.
          </p>
        </div>
      ) : null}
    </section>
  );
}
