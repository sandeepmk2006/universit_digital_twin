import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Campus assistant answered by Gemini. Context comes from the handbook (kb_documents) and
// the caller's own records, read with their session, so row-level security decides what
// the model can see: a student's question is answered from that student's data only.
// Tried in order; a busy or retired model falls through to the next.
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];

async function contextFor(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: kb }] = await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id", user.id).single(),
    supabase.from("kb_documents").select("title,content").limit(40),
  ]);
  const lines = [`User: ${profile?.full_name ?? "unknown"} (role: ${profile?.role ?? "unknown"})`];
  if (profile?.role === "student") {
    const { data: s } = await supabase
      .from("v_student_directory")
      .select("roll_no,department,current_semester,cgpa,attendance_pct,predicted_gpa,risk_level")
      .eq("email", user.email ?? "")
      .maybeSingle();
    if (s) lines.push(`Student record: ${JSON.stringify(s)}`);
    const { data: inv } = await supabase
      .from("invoices")
      .select("amount,due_on,status,academic_terms!inner(is_current)")
      .eq("academic_terms.is_current", true);
    if (inv?.length) lines.push(`Current fee invoice: ${JSON.stringify(inv)}`);
  }
  const handbook = (kb ?? []).map((d) => `## ${d.title}\n${d.content}`).join("\n\n");
  return `${lines.join("\n")}\n\nUniversity handbook:\n${handbook}`;
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "The assistant is not configured." }, { status: 503 });
  try {
    const { message } = (await request.json()) as { message?: string };
    if (!message?.trim()) return NextResponse.json({ error: "Type a question first." }, { status: 400 });
    const supabase = await createClient();
    const context = await contextFor(supabase);
    if (!context) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

    const request_ = (model: string) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are the EduBase campus assistant for a university. Answer briefly and only " +
                  "from the context below. If the context does not contain the answer, say so and " +
                  "suggest which office to contact. Never reveal other people's personal data.\n\n" +
                  context,
              },
            ],
          },
          contents: [{ role: "user", parts: [{ text: message.slice(0, 2000) }] }],
        }),
        signal: AbortSignal.timeout(15_000),
      }).catch(() => null); // timed out: try the next model
    let r: Response | null = null;
    for (const model of MODELS) {
      r = await request_(model);
      if (r && (r.ok || ![404, 429, 500, 503].includes(r.status))) break;
    }
    if (!r?.ok) return NextResponse.json({ error: "The assistant service is busy; try again shortly." }, { status: 502 });
    const body = await r.json();
    const reply = (body.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return NextResponse.json({ reply: reply || "No answer was returned." });
  } catch {
    return NextResponse.json({ error: "The assistant service is unavailable." }, { status: 502 });
  }
}
