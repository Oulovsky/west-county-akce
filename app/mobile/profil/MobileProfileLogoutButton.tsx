"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { supabase } from "@/lib/supabase";

export function MobileProfileLogoutButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await supabase.auth.signOut();
      router.replace("/login");
    });
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className="w-full rounded-2xl border border-red-500/40 bg-red-950/30 px-4 py-4 text-base font-black text-red-100 transition hover:bg-red-900/40 disabled:opacity-60"
    >
      {isPending ? "Odhlašuji…" : "Odhlásit"}
    </button>
  );
}
