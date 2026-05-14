"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { updateUserRole } from "./users/actions";

export default function UsersClient({ users }: { users: any[] }) {
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleUpdate = (userId: string, formData: FormData) => {
    const role = String(formData.get("role"));

    startTransition(async () => {
      const res = await updateUserRole(userId, role);

      if (res.ok) {
        setToast({ message: "Role změněna", type: "success" });
        router.refresh();
      } else {
        setToast({ message: res.error || "Chyba", type: "error" });
      }
    });
  };

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <form
          key={user.user_id}
          action={(formData) => handleUpdate(user.user_id, formData)}
          className="flex items-center justify-between border p-2"
        >
          <span>{user.email}</span>

          <div className="flex gap-2">
            <select
              name="role"
              defaultValue={user.role}
              className="border px-2 py-1"
              disabled={isPending}
            >
              <option value="admin">admin</option>
              <option value="sef">sef</option>
              <option value="skladnik">skladnik</option>
              <option value="zamestnanec">zamestnanec</option>
            </select>

            <button className="border px-2" disabled={isPending}>
              Uložit
            </button>
          </div>
        </form>
      ))}

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