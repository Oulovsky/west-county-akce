import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getRolePermissions } from "@/lib/roles"

type Props = {
  zakazkaId: string
}

export default async function RoleActions({ zakazkaId }: Props) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let role: string | null = null

  if (user?.id) {
    const { data } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle()

    role = data?.role ?? null
  }

  const perms = getRolePermissions(role)

  return (
    <div style={{ display: "flex", gap: "12px", marginTop: "12px", marginBottom: "20px" }}>

      {perms.technikaCteni && (
        <Link href={`/zakazky/${zakazkaId}/technika`}>
          <button style={{
            backgroundColor: "#2563eb",
            color: "white",
            padding: "8px 14px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer"
          }}>
            Technika
          </button>
        </Link>
      )}

      {perms.nakladkaCteni && (
        <Link href={`/zakazky/${zakazkaId}/scan`}>
          <button style={{
            backgroundColor: "#16a34a",
            color: "white",
            padding: "8px 14px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer"
          }}>
            Nakládka
          </button>
        </Link>
      )}

      {perms.historieCteni && (
        <Link href={`/zakazky/${zakazkaId}/historie`}>
          <button style={{
            backgroundColor: "#6b7280",
            color: "white",
            padding: "8px 14px",
            borderRadius: "6px",
            border: "none",
            cursor: "pointer"
          }}>
            Historie
          </button>
        </Link>
      )}

    </div>
  )
}