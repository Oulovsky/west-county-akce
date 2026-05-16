"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  createPlaceFromZakazkaAction,
  linkZakazkaToExistingPlaceAction,
} from "../actions";
import { Card } from "@/components/ui/card";

export type ExistingPlaceOption = {
  misto_id: string;
  nazev: string | null;
  adresa_text: string | null;
  klient_id: string | null;
};

type ZakazkaPlaceSnapshot = {
  zakazkaId: string;
  nazev: string | null;
  klientId: string | null;
  misto: string | null;
  mistoLat: string | number | null;
  mistoLng: string | number | null;
  mistoRadius: string | number | null;
};

function getCoordinateLabel(value: string | number | null) {
  const text = String(value ?? "").trim();
  return text || "—";
}

export function ZakazkaPlaceConnectionCard({
  zakazka,
  places,
}: {
  zakazka: ZakazkaPlaceSnapshot;
  places: ExistingPlaceOption[];
}) {
  const [mode, setMode] = useState<"create" | "link">("create");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string; mistoId?: string | null } | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredPlaces = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("cs-CZ");
    if (!q) return places.slice(0, 12);

    return places
      .filter((place) =>
        [place.nazev ?? "", place.adresa_text ?? ""]
          .join(" ")
          .toLocaleLowerCase("cs-CZ")
          .includes(q)
      )
      .slice(0, 20);
  }, [places, search]);

  function createPlace() {
    const formData = new FormData();
    formData.append("zakazka_id", zakazka.zakazkaId);

    startTransition(async () => {
      const result = await createPlaceFromZakazkaAction(formData);
      if (result.ok) {
        setMessage({
          type: "success",
          text: "Místo bylo vytvořené a propojené se zakázkou. Snapshot zakázky zůstal beze změny.",
          mistoId: result.mistoId,
        });
        window.setTimeout(() => window.location.reload(), 700);
        return;
      }

      setMessage({
        type: "error",
        text: result.errorMessage || "Vytvoření místa se nepodařilo.",
      });
    });
  }

  function linkPlace(mistoId: string) {
    const formData = new FormData();
    formData.append("zakazka_id", zakazka.zakazkaId);
    formData.append("misto_id", mistoId);

    startTransition(async () => {
      const result = await linkZakazkaToExistingPlaceAction(formData);
      if (result.ok) {
        setMessage({
          type: "success",
          text: "Místo bylo propojené se zakázkou. Snapshot zakázky zůstal beze změny.",
          mistoId: result.mistoId,
        });
        window.setTimeout(() => window.location.reload(), 700);
        return;
      }

      setMessage({
        type: "error",
        text: result.errorMessage || "Propojení místa se nepodařilo.",
      });
    });
  }

  return (
    <Card className="mt-6 space-y-5 border-amber-500/40 bg-amber-950/10">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xl font-black text-amber-100">Zakázka není propojena s místem</div>
          <p className="mt-1 max-w-3xl text-sm leading-relaxed text-amber-100/80">
            Propojením vznikne vazba na dlouhodobé know-how místa. Text místa, adresa a GPS snapshot v zakázce se nepřepíší.
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100">
          Jen vazba `misto_id`
        </div>
      </div>

      {message ? (
        <div
          className={[
            "rounded-xl border px-4 py-3 text-sm font-semibold",
            message.type === "success"
              ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-100"
              : "border-red-500/40 bg-red-950/20 text-red-200",
          ].join(" ")}
        >
          {message.text}
          {message.mistoId ? (
            <Link
              href={`/mista/${message.mistoId}`}
              className="ml-2 inline-flex text-blue-200 underline-offset-4 hover:text-blue-100 hover:underline"
            >
              Otevřít detail místa
            </Link>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={[
            "rounded-xl border px-4 py-3 text-sm font-black transition",
            mode === "create"
              ? "border-blue-500 bg-blue-600/20 text-white"
              : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900",
          ].join(" ")}
        >
          Vytvořit místo
        </button>
        <button
          type="button"
          onClick={() => setMode("link")}
          className={[
            "rounded-xl border px-4 py-3 text-sm font-black transition",
            mode === "link"
              ? "border-blue-500 bg-blue-600/20 text-white"
              : "border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-900",
          ].join(" ")}
        >
          Vybrat existující místo
        </button>
      </div>

      {mode === "create" ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="grid gap-3 text-sm text-slate-300 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Název místa</div>
              <div className="mt-1 font-semibold text-white">{zakazka.misto || zakazka.nazev || "Místo konání"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Klient</div>
              <div className="mt-1 font-semibold text-white">{zakazka.klientId ? "Převezme se ze zakázky" : "Bez klienta"}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">GPS</div>
              <div className="mt-1 font-semibold text-white">
                {getCoordinateLabel(zakazka.mistoLat)}, {getCoordinateLabel(zakazka.mistoLng)}
              </div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-slate-500">Radius</div>
              <div className="mt-1 font-semibold text-white">{getCoordinateLabel(zakazka.mistoRadius)} m</div>
            </div>
          </div>

          <button
            type="button"
            onClick={createPlace}
            disabled={isPending}
            className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? "Vytvářím..." : "Vytvořit místo a propojit"}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <label className="block text-sm font-semibold text-slate-200">
            Hledat místo podle názvu nebo adresy
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white"
              placeholder="Začněte psát název místa..."
            />
          </label>

          <div className="mt-4 grid gap-2">
            {filteredPlaces.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-700 px-4 py-5 text-sm text-slate-400">
                Žádné místo neodpovídá hledání.
              </div>
            ) : (
              filteredPlaces.map((place) => (
                <button
                  key={place.misto_id}
                  type="button"
                  onClick={() => linkPlace(place.misto_id)}
                  disabled={isPending}
                  className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-left transition hover:border-blue-500/60 hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="font-black text-white">{place.nazev || "Místo konání"}</div>
                  {place.adresa_text ? <div className="mt-1 text-sm text-slate-400">{place.adresa_text}</div> : null}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
