import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: term } = await supabase
      .from("academic_terms")
      .select("id")
      .eq("is_current", true)
      .single();
    if (!term)
      return NextResponse.json(
        { error: "No current academic term is configured." },
        { status: 400 },
      );
    const r = await fetch(`${process.env.ML_SERVICE_URL}/allocate/rooms/${term.id}`, {
      method: "POST",
    });
    if (!r.ok)
      return NextResponse.json(
        { error: "The allocation service is unavailable." },
        { status: 502 },
      );
    return NextResponse.json(await r.json());
  } catch {
    return NextResponse.json({ error: "The allocation service is unavailable." }, { status: 502 });
  }
}
