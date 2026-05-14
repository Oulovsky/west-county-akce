"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { addWhitelistEmail, deleteWhitelistEmail } from "./whitelist/actions";

export default function WhitelistClient({ whitelist }: { whitelist: any[] }) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAdd = (formData: FormData) => {
    const email = String(formData.get("email") || "");

    startTransition(async () => {
      const res = await addWhitelistEmail(email);

      if (res.ok) {
        setToast({ message: "Email přidán", type: "success" });
        router.refresh();
      } else {
        setToast({ message: res.error || "Chyba", type: "error" });
      }
    });
  };

  const handleDelete = (email: string) => {
    startTransition(async () => {
      const res = await deleteWhitelistEmail(email);

      if (res.ok) {
        setToast({ message: "Email smazán", type: "success" });
        router.refresh();
      } else {
        setToast({ message: res.error || "Chyba", type: "error" });
      }
    });
  };

  return (
    <div>
      <form action={handleAdd} className="flex gap-2 mb-4">
        <input
          type="email"
          name="email"
          placeholder="email@example.com"
          className="border px-2 py-1"
          required
        />
        <button className="border px-3 py-1" disabled={isPending}>
          Přidat
        </button>
      </form>

      <div className="space-y-2">
        {whitelist.map((item) => (
          <div
            key={item.email}
            className="flex items-center justify-between border p-2"
          >
            <span>{item.email}</span>

            <button
              onClick={() => handleDelete(item.email)}
              className="text-red-600"
              disabled={isPending}
            >
              Smazat
            </button>
          </div>
        ))}
      </div>

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