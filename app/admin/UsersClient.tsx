"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import {
  createEmployee,
  deactivateEmployee,
  updateUserActionCost,
  updateUserEmail,
  updateUserName,
  updateUserRole,
} from "./users/actions";

type UserRow = {
  user_id: string;
  email: string;
  role: string;
  jmeno?: string | null;
  prijmeni?: string | null;
  hodinovy_naklad_akce?: number | string | null;
  aktivni?: boolean | null;
};

function normalizeCost(value: string | number | null | undefined) {
  const text = String(value ?? "").trim().replace(",", ".");
  if (!text) return "0";
  const number = Number(text);
  return Number.isFinite(number) ? String(number) : text;
}

function getFullName(user: UserRow) {
  return [user.jmeno, user.prijmeni].filter(Boolean).join(" ").trim();
}

function UserEditorRow({
  user,
  onToast,
}: {
  user: UserRow;
  onToast: (toast: { message: string; type: "success" | "error" }) => void;
}) {
  const [role, setRole] = useState(user.role);
  const [savedRole, setSavedRole] = useState(user.role);
  const [name, setName] = useState(getFullName(user));
  const [savedName, setSavedName] = useState(getFullName(user));
  const [email, setEmail] = useState(user.email);
  const [savedEmail, setSavedEmail] = useState(user.email);
  const [hourlyCost, setHourlyCost] = useState(
    user.hodinovy_naklad_akce == null ? "" : String(user.hodinovy_naklad_akce)
  );
  const [savedHourlyCost, setSavedHourlyCost] = useState(
    user.hodinovy_naklad_akce == null ? "" : String(user.hodinovy_naklad_akce)
  );
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    setRole(user.role);
    setSavedRole(user.role);
    const nextName = getFullName(user);
    setName(nextName);
    setSavedName(nextName);
    setEmail(user.email);
    setSavedEmail(user.email);
    const nextCost = user.hodinovy_naklad_akce == null ? "" : String(user.hodinovy_naklad_akce);
    setHourlyCost(nextCost);
    setSavedHourlyCost(nextCost);
  }, [user.role, user.jmeno, user.prijmeni, user.email, user.hodinovy_naklad_akce]);

  function saveName(nextName = name) {
    const current = nextName.trim();
    if (current === savedName.trim() || isPending) return;

    startTransition(async () => {
      const result = await updateUserName(user.user_id, current);
      if (result.ok) {
        setSavedName(current);
        onToast({ message: "Jméno uloženo", type: "success" });
        router.refresh();
      } else {
        setName(savedName);
        onToast({ message: result.error || "Uložení jména selhalo", type: "error" });
      }
    });
  }

  function saveRole(nextRole: string) {
    setRole(nextRole);
    if (nextRole === savedRole || isPending) return;

    startTransition(async () => {
      const result = await updateUserRole(user.user_id, nextRole);
      if (result.ok) {
        setSavedRole(nextRole);
        onToast({ message: "Role uložena", type: "success" });
        router.refresh();
      } else {
        setRole(savedRole);
        onToast({ message: result.error || "Uložení role selhalo", type: "error" });
      }
    });
  }

  function saveEmail(nextEmail = email) {
    const current = nextEmail.trim().toLowerCase();
    const saved = savedEmail.trim().toLowerCase();
    if (current === saved || isPending) return;

    startTransition(async () => {
      const result = await updateUserEmail(user.user_id, current);
      if (result.ok) {
        setEmail(current);
        setSavedEmail(current);
        onToast({ message: "Email uložen", type: "success" });
        router.refresh();
      } else {
        setEmail(savedEmail);
        onToast({ message: result.error || "Uložení emailu selhalo", type: "error" });
      }
    });
  }

  function saveHourlyCost(nextCost = hourlyCost) {
    const current = normalizeCost(nextCost);
    const saved = normalizeCost(savedHourlyCost);
    if (current === saved || isPending) return;

    startTransition(async () => {
      const result = await updateUserActionCost(user.user_id, nextCost);
      if (result.ok) {
        setSavedHourlyCost(nextCost);
        onToast({ message: "Hodinová mzda uložena", type: "success" });
        router.refresh();
      } else {
        onToast({ message: result.error || "Uložení hodinové mzdy selhalo", type: "error" });
      }
    });
  }

  function removeEmployee() {
    const confirmed = window.confirm(
      `Odebrat zaměstnance ${savedName || savedEmail}? Historie zakázek zůstane zachovaná.`
    );
    if (!confirmed || isPending) return;

    startTransition(async () => {
      const result = await deactivateEmployee(user.user_id);
      if (result.ok) {
        onToast({ message: "Zaměstnanec odebrán", type: "success" });
        router.refresh();
      } else {
        onToast({ message: result.error || "Odebrání zaměstnance selhalo", type: "error" });
      }
    });
  }

  return (
    <div className="grid gap-4 rounded-xl border border-slate-700 bg-slate-950/40 p-4 xl:grid-cols-[1.1fr_1fr_auto]">
      <div className="min-w-0">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Jméno
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={(event) => saveName(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setName(savedName);
                event.currentTarget.blur();
              }
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            disabled={isPending}
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Email
          </span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            onBlur={(event) => saveEmail(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setEmail(savedEmail);
                event.currentTarget.blur();
              }
            }}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60"
            disabled={isPending}
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-[10rem_12rem] sm:gap-x-3 sm:gap-y-1">
        <label className="block sm:contents">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-start-1 sm:row-start-1">
            Role
          </span>
          <select
            name="role"
            value={role}
            onChange={(event) => saveRole(event.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 sm:col-start-1 sm:row-start-2 sm:mt-0"
            disabled={isPending}
          >
            <option value="admin">admin</option>
            <option value="sef">sef</option>
            <option value="skladnik">skladnik</option>
            <option value="zamestnanec">zamestnanec</option>
          </select>
        </label>

        <label className="block sm:contents">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-start-2 sm:row-start-1">
            Hodinová mzda pro akce
          </span>
          <input
            name="hodinovy_naklad_akce"
            value={hourlyCost}
            onChange={(event) => setHourlyCost(event.target.value)}
            onBlur={(event) => saveHourlyCost(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setHourlyCost(savedHourlyCost);
                event.currentTarget.blur();
              }
            }}
            inputMode="decimal"
            placeholder="Kč / hod"
            className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60 sm:col-start-2 sm:row-start-2 sm:mt-0"
            disabled={isPending}
            aria-describedby={`${user.user_id}-hourly-cost-help`}
          />
          <span id={`${user.user_id}-hourly-cost-help`} className="mt-1 block text-xs text-slate-400 sm:col-start-2 sm:row-start-3">
            Interní kalkulační náklad, ne reálná mzda zaměstnance.
          </span>
        </label>
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-500 xl:items-end xl:text-right">
        {user.aktivni === false ? (
          <span className="rounded-full border border-slate-600 bg-slate-800 px-2 py-1 font-semibold text-slate-300">
            Neaktivní
          </span>
        ) : (
          <span className="rounded-full border border-emerald-600/40 bg-emerald-950/30 px-2 py-1 font-semibold text-emerald-200">
            Aktivní
          </span>
        )}
        {user.aktivni !== false ? (
          <button
            type="button"
            onClick={removeEmployee}
            disabled={isPending}
            className="rounded-lg border border-red-700 bg-red-950/40 px-3 py-2 text-sm font-semibold text-red-100 transition hover:bg-red-900/50 disabled:opacity-60"
          >
            Odebrat
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function UsersClient({ users }: { users: UserRow[] }) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [isCreating, startCreateTransition] = useTransition();
  const router = useRouter();
  const activeUsers = users.filter((user) => user.aktivni !== false);
  const inactiveUsers = users.filter((user) => user.aktivni === false);

  function handleCreateEmployee(formData: FormData) {
    startCreateTransition(async () => {
      const result = await createEmployee(formData);
      if (result.ok) {
        setToast({ message: "Zaměstnanec přidán", type: "success" });
        setAddOpen(false);
        router.refresh();
      } else {
        setToast({ message: result.error || "Přidání zaměstnance selhalo", type: "error" });
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Email zaměstnance se automaticky povolí pro přístup do systému.
        </p>
        <Button onClick={() => setAddOpen(true)}>Přidat zaměstnance</Button>
      </div>

      {activeUsers.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-950/40 px-4 py-3 text-sm text-slate-400">
          Zatím není založený žádný zaměstnanec.
        </div>
      ) : null}

      {activeUsers.map((user) => (
        <UserEditorRow key={user.user_id} user={user} onToast={setToast} />
      ))}

      {inactiveUsers.length > 0 ? (
        <details className="rounded-xl border border-slate-700 bg-slate-950/30">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-300">
            Neaktivní zaměstnanci ({inactiveUsers.length})
          </summary>
          <div className="space-y-3 border-t border-slate-800 p-3">
            {inactiveUsers.map((user) => (
              <UserEditorRow key={user.user_id} user={user} onToast={setToast} />
            ))}
          </div>
        </details>
      ) : null}

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Přidat zaměstnance"
        widthClassName="max-w-xl"
      >
        <form action={handleCreateEmployee} className="space-y-4">
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Jméno</span>
            <Input name="name" required placeholder="Např. Jan Novák" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Email</span>
            <Input name="email" type="email" required placeholder="jan@example.cz" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">Role</span>
            <select
              name="role"
              required
              defaultValue="zamestnanec"
              className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0f172a] px-4 py-3 text-base text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="admin">admin</option>
              <option value="sef">sef</option>
              <option value="skladnik">skladnik</option>
              <option value="zamestnanec">zamestnanec</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-200">
              Hodinová mzda pro akce
            </span>
            <Input name="hodinovy_naklad_akce" inputMode="decimal" defaultValue="0" />
            <span className="mt-1 block text-xs text-slate-400">
              Interní kalkulační náklad, ne reálná mzda zaměstnance.
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={isCreating}>
              Zrušit
            </Button>
            <Button type="submit" disabled={isCreating}>
              {isCreating ? "Přidávám..." : "Přidat zaměstnance"}
            </Button>
          </div>
        </form>
      </Modal>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
