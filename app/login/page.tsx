"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildOAuthCallbackRedirectUrl,
  getAppBaseUrlClient,
  getSafeNextPath,
} from "@/lib/auth/oauth-redirect";

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const queryError =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("error")
      : null;
  const visibleError =
    error ||
    (queryError === "not_allowed"
      ? "Tento Google účet není povolený pro beta přístup."
      : "");

  function getLoginNextPath() {
    const next = new URLSearchParams(window.location.search).get("next");
    return getSafeNextPath(next);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    setError("");

    const baseUrl = getAppBaseUrlClient();
    if (!baseUrl) {
      setGoogleLoading(false);
      setError("Chybí adresa aplikace (NEXT_PUBLIC_APP_URL nebo origin).");
      return;
    }

    const next = getLoginNextPath();
    const callbackUrl = buildOAuthCallbackRedirectUrl(next, baseUrl);

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callbackUrl,
      },
    });

    if (oauthError) {
      setGoogleLoading(false);
      setError("Nepodařilo se spustit přihlášení přes Google");
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "440px",
          display: "grid",
          gap: "16px",
          background: "#111827",
          padding: "24px",
          borderRadius: "12px",
          border: "1px solid #374151",
        }}
      >
        <h1 style={{ fontSize: "28px", fontWeight: 800 }}>Přihlášení</h1>

        <div style={{ color: "#94a3b8", lineHeight: 1.5 }}>
          Přihlášení do systému probíhá přes Google účet.
        </div>

        {visibleError && (
          <div style={{ color: "#f87171" }}>{visibleError}</div>
        )}

        <button
          type="button"
          onClick={() => void handleGoogleLogin()}
          disabled={googleLoading}
          style={{
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid #374151",
            background: "#020617",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
            opacity: googleLoading ? 0.6 : 1,
          }}
        >
          {googleLoading ? "Přesměrovávám…" : "Pokračovat přes Google"}
        </button>
      </div>
    </main>
  );
}
