"use client";

import { useEffect, useState } from "react";
import { getInternalNavVisibility } from "@/lib/auth/internal-role-access";
import { supabase } from "@/lib/supabase";

export function useProfileRole() {
  const [role, setRole] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRole() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) {
          setRole(null);
          setLoaded(true);
        }
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;
      setRole(profile?.role ?? null);
      setLoaded(true);
    }

    void loadRole();

    return () => {
      active = false;
    };
  }, []);

  const nav = getInternalNavVisibility(role);

  return {
    role,
    loaded,
    nav,
  };
}
