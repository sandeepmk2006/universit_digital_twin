import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const r = await fetch(`${process.env.ML_SERVICE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!r.ok)
      return NextResponse.json({ error: "The assistant service is unavailable." }, { status: 502 });
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: "The assistant service is unavailable." }, { status: 502 });
  }
}
