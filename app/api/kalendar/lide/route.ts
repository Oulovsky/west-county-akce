import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!from || !to) {
      return NextResponse.json(
        { error: "Missing from/to" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { data, error } = await supabase.rpc("get_kalendar_lide", {
      p_from: new Date(from).toISOString(),
      p_to: new Date(to).toISOString(),
    });

    if (error) {
      console.error("RPC ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return new NextResponse(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
    });
  } catch (e) {
    console.error("API ERROR:", e);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 }
    );
  }
}
