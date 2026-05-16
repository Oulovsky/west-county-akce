import { requireSession } from "@/lib/auth/require-session"
import { NextResponse } from "next/server"

export async function GET() {
  const session = await requireSession()
  if (!session.ok) return session.response

  return NextResponse.json({
    email: session.email,
  })
}