type SkladDetailHeaderProps = {
  skladovaPolozkaId: string;
  deleteAction: (formData: FormData) => Promise<void>;
};

export function SkladDetailHeader({
  skladovaPolozkaId,
  deleteAction,
}: SkladDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <form action="/sklad/sprava">
        <button
          type="submit"
          className="inline-flex items-center rounded-xl border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:bg-slate-800 hover:text-white"
        >
          ← Zpět na správu skladu
        </button>
      </form>

      <form action={deleteAction}>
        <input type="hidden" name="skladova_polozka_id" value={skladovaPolozkaId} />
        <button
          type="submit"
          className="rounded-xl border border-red-700 bg-red-950 px-4 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-900"
        >
          Smazat hlavní položku
        </button>
      </form>
    </div>
  );
}
