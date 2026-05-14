"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AuthGate({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function check() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session) {
        setLoading(false)
        if (pathname !== "/login") router.replace("/login")
        return
      }

      const email = session.user.email?.toLowerCase()

      const { data: allowed } = await supabase
        .from("povolene_emaily")
        .select("email")
        .eq("email", email)
        .maybeSingle()

      if (!allowed) {
        await supabase.auth.signOut()
        setLoading(false)
        router.replace("/login")
        return
      }

      setLoading(false)

      if (pathname === "/login") {
        router.replace("/zakazky")
      }
    }

    void check()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void check()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [pathname, router])

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        Načítání…
      </main>
    )
  }

  return <>{children}</>
}
