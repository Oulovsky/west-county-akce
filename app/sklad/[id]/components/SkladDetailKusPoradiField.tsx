"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UpdateKusPoradiResult } from "../actions/updateKusPoradi";

type Props = {
  skladovaPolozkaId: string;
  kusId: string;
  committedPoradi: number;
  updateKusPoradiAction: (
    formData: FormData
  ) => Promise<UpdateKusPoradiResult>;
};

export function SkladDetailKusPoradiField({
  skladovaPolozkaId,
  kusId,
  committedPoradi,
  updateKusPoradiAction,
}: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState(String(committedPoradi));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const committedRef = useRef(committedPoradi);

  useEffect(() => {
    committedRef.current = committedPoradi;
    setDraft(String(committedPoradi));
    setError(null);
  }, [committedPoradi, kusId]);

  const commitIfChanged = useCallback(async () => {
    const n = Number(draft.trim());
    if (!Number.isInteger(n) || n < 1) {
      setError("Pořadové číslo musí být celé číslo 1 nebo vyšší.");
      return;
    }
    if (n === committedRef.current) {
      setError(null);
      return;
    }

    setPending(true);
    setError(null);

    const fd = new FormData();
    fd.set("skladova_polozka_id", skladovaPolozkaId);
    fd.set("kus_id", kusId);
    fd.set("poradove_cislo", String(n));

    const res = await updateKusPoradiAction(fd);
    setPending(false);

    if (!res.ok) {
      setError(res.error);
      return;
    }

    committedRef.current = n;
    router.refresh();
  }, [draft, kusId, router, skladovaPolozkaId, updateKusPoradiAction]);

  return (
    <div className="flex shrink-0 flex-col items-stretch gap-0.5">
      <input
        type="number"
        min={1}
        step={1}
        disabled={pending}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commitIfChanged()}
        onKeyDown={(e) => {
          if (e.key !== "Enter") return;
          e.preventDefault();
          void commitIfChanged();
        }}
        aria-label="Pořadové číslo kusu"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${kusId}-poradi-err` : undefined}
        className="h-12 w-[4.25rem] shrink-0 rounded-xl border border-slate-700 bg-slate-950 px-2 text-center text-sm font-semibold text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 disabled:opacity-60"
      />
      {error ? (
        <p
          id={`${kusId}-poradi-err`}
          className="max-w-[11rem] text-right text-[11px] leading-snug text-red-300"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
