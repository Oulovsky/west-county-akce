import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-session";

type RequestBody = {
  bloky?: string[];
};

export async function POST(req: Request) {
  try {
    const session = await requireSession();

    if (!session.ok) {
      return session.response;
    }

    const body = (await req.json()) as RequestBody;

    const bloky = Array.isArray(body.bloky)
      ? body.bloky.filter(
          (x): x is string => typeof x === "string" && x.trim() !== ""
        )
      : [];

    const { supabase } = session;

    const { data, error } = await supabase.rpc("set_sklad_bloky_poradi", {
      p_bloky: bloky,
    });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          where: "rpc:set_sklad_bloky_poradi",
          message: error.message ?? null,
          code:
            "code" in error
              ? (error as { code?: string }).code ?? null
              : null,
          details:
            "details" in error
              ? (error as { details?: string }).details ?? null
              : null,
          hint:
            "hint" in error
              ? (error as { hint?: string }).hint ?? null
              : null,
          received: bloky,
          returnedData: data ?? null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      received: bloky,
      returnedData: data ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        where: "route:catch",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}