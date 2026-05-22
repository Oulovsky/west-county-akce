import { requireSession } from "@/lib/auth/require-session"
import { NextResponse } from "next/server"

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const session = await requireSession()
  if (!session.ok) return session.response

  return NextResponse.json({
    email: session.email,
  })
}