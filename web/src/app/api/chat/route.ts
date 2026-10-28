import { NextResponse } from "next/server";
import { assistantContext, studyCourse } from "@/lib/assistant-context";

// Campus and study assistant answered by Gemini. Context is rebuilt on every turn from
// the caller's own session (row-level security bounds it) and the conversation so far.
// Tried in order; a busy or retired model falls through to the next.
const MODELS = [process.env.GEMINI_MODEL ?? "gemini-3.8-flash", "gemini-flash-latest", "gemini-flash-lite-latest"];

type Msg = { role: "user" | "assistant"; content: string };

const STYLE =
  "Format answers in Markdown: short paragraphs, **bold** for key facts, bullet or numbered lists for several items, " +
  "and a Markdown table for schedules or marks (e.g. day, time, course, room). Keep answers concise and specific to the user. " +
  "Use the user's own data in the context; do not say information is unavailable if it is in the context.";

function campusPrompt(context: string) {
  return (
    "You are the EduBase campus assistant for a university. Answer only from the context below; if it does not contain " +
    "the answer, say so briefly and name the office to contact. Never reveal other people's personal data. " +
    STYLE + "\n\n" + context
  );
}

function studyPrompt(context: string, course: { code: string; title: string; description?: string; tags?: string[] }) {
  return (
    `You are a patient study tutor for a university student taking ${course.code} ${course.title}` +
    `${course.description ? ` (${course.description})` : ""}${course.tags?.length ? `; topics: ${course.tags.join(", ")}` : ""}. ` +
    "Teach at undergraduate level: explain step by step with small examples, give practice questions with answers when asked, " +
    "and build study plans around the student's real exam dates, marks and attendance from the context. " +
    "Stay on academic topics; for campus questions point to the Assistant tab. " +
    STYLE + "\n\n" + context
  );
}

export async function POST(request: Request) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "The assistant is not configured." }, { status: 503 });
  try {
    const body = (await request.json()) as {
      messages?: Msg[];
      message?: string;
      mode?: "campus" | "study";
      sectionId?: string;
      page?: string;
    };
    const messages: Msg[] = (body.messages ?? (body.message ? [{ role: "user", content: body.message }] : []))
      .filter((m) => m.content?.trim())
      .slice(-12);
    if (!messages.length || messages[messages.length - 1].role !== "user")
      return NextResponse.json({ error: "Type a question first." }, { status: 400 });

    const context = await assistantContext(body.page);
    if (!context) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    let system = campusPrompt(context);
    if (body.mode === "study") {
      const course = body.sectionId ? await studyCourse(body.sectionId) : null;
      if (!course) return NextResponse.json({ error: "Choose one of your courses first." }, { status: 400 });
      system = studyPrompt(context, course);
    }

    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content.slice(0, 4000) }],
      })),
    });
    const call = (model: string) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: payload,
        signal: AbortSignal.timeout(20_000),
      }).catch(() => null); // timed out: try the next model
    let r: Response | null = null;
    for (const model of MODELS) {
      r = await call(model);
      if (r && (r.ok || ![404, 429, 500, 503].includes(r.status))) break;
    }
    if (!r?.ok) return NextResponse.json({ error: "The assistant is busy right now; please try again." }, { status: 502 });
    const out = await r.json();
    const reply = (out.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return NextResponse.json({ reply: reply || "No answer was returned." });
  } catch {
    return NextResponse.json({ error: "The assistant is busy right now; please try again." }, { status: 502 });
  }
}
