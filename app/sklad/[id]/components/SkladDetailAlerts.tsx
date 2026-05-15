import Link from "next/link";

export function SkladDetailLoadError({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-red-800 bg-red-950/40 px-4 py-6 text-red-200">
      Chyba: {message}
    </div>
  );
}

export function SkladDetailConfigError({ messages }: { messages: string[] }) {
  return (
    <div className="rounded-2xl border border-red-800 bg-red-950/40 px-4 py-6 text-red-200">
      Chyba konfigurace: {messages.join(" | ")}
    </div>
  );
}

export function SkladDetailNotFound() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/sklad/sprava"
          className="inline-flex items-center text-sm font-medium text-slate-300 transition hover:text-white"
        >
          ← Zpět na správu skladu
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-6 text-slate-200">
        Položka nenalezena.
      </div>
    </div>
  );
}
