"use client";

import { Bot, Send, Sparkles, Trash2, User } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; content: string; error?: boolean };

// ---------- minimal Markdown → React (bold, italics, code, lists, tables, headings) ----------
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) out.push(<strong key={m.index}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`"))
      out.push(
        <code key={m.index} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em]">
          {t.slice(1, -1)}
        </code>,
      );
    else out.push(<em key={m.index}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (row: string) =>
  row.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r/g, "").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      blocks.push(
        <pre key={i} className="overflow-x-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">
          {code.join("\n")}
        </pre>,
      );
      continue;
    }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) body.push(cells(lines[i++]));
      blocks.push(
        <div key={i} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="bg-slate-50">
                {head.map((h, k) => (
                  <th key={k} className="border border-[var(--line)] px-2 py-1.5 font-semibold">
                    {inline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, k) => (
                <tr key={k}>
                  {r.map((c, j) => (
                    <td key={j} className="border border-[var(--line)] px-2 py-1.5">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={i} className="border-[var(--line)]" />);
      i++;
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)/);
    if (h) {
      blocks.push(
        <p key={i} className="font-semibold text-[var(--ink)]">
          {inline(h[2])}
        </p>,
      );
      i++;
      continue;
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(line)) {
      const ordered = /^\s*\d/.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*•]|\d+[.)])\s+/.test(lines[i]))
        items.push(lines[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""));
      const Tag = ordered ? "ol" : "ul";
      blocks.push(
        <Tag key={i} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
          {items.map((t, k) => (
            <li key={k}>{inline(t)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(\s*([-*•]|\d+[.)])\s+|#{1,4}\s|```|\s*\||\s*([-*_])\3{2,}\s*$)/.test(lines[i]))
      para.push(lines[i++]);
    if (!para.length) para.push(lines[i++]);
    blocks.push(<p key={i}>{inline(para.join(" "))}</p>);
  }
  return <div className="space-y-2 leading-relaxed">{blocks}</div>;
}

// ---------- chat ----------
export function Chat({
  mode = "campus",
  sectionId,
  greeting,
  suggestions,
  storageKey,
}: {
  mode?: "campus" | "study";
  sectionId?: string;
  greeting: string;
  suggestions: string[];
  storageKey: string;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  // Keep the conversation for this browser tab (per course in study mode).
  useEffect(() => {
    try {
      setMessages(JSON.parse(sessionStorage.getItem(storageKey) ?? "[]"));
    } catch {
      setMessages([]);
    }
  }, [storageKey]);
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-20)));
    } catch {}
    end.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, storageKey]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages.filter((m) => !m.error), { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          sectionId,
          page: typeof window !== "undefined" ? document.title : undefined,
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });
      const b = await r.json();
      setMessages([...next, b.reply ? { role: "assistant", content: b.reply } : { role: "assistant", content: b.error ?? "Something went wrong.", error: true }]);
    } catch {
      setMessages([...next, { role: "assistant", content: "Could not reach the assistant. Check your connection and try again.", error: true }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[480px] flex-col rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-sm">
      <div className="flex items-center justify-between border-b border-[var(--line)] px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Sparkles size={16} className="text-indigo-600" />
          {mode === "study" ? "Study session" : "Conversation"}
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-rose-600"
          >
            <Trash2 size={14} /> New chat
          </button>
        )}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl py-6 text-center">
            <Bot size={32} className="mx-auto text-indigo-600" />
            <p className="mt-3 text-[var(--muted)]">{greeting}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-[var(--line)] px-3 py-1.5 text-xs hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, k) => (
          <div key={k} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
            {m.role === "assistant" && (
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                <Bot size={16} />
              </span>
            )}
            <div
              className={
                m.role === "user"
                  ? "max-w-[80%] rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 text-white"
                  : m.error
                    ? "max-w-[85%] rounded-2xl rounded-tl-sm border border-rose-200 bg-rose-50 px-4 py-2.5 text-rose-700"
                    : "max-w-[85%] rounded-2xl rounded-tl-sm border border-[var(--line)] bg-white px-4 py-3 text-[var(--ink)]"
              }
            >
              {m.role === "assistant" && !m.error ? <Markdown text={m.content} /> : m.content}
            </div>
            {m.role === "user" && (
              <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <User size={16} />
              </span>
            )}
          </div>
        ))}
        {busy && (
          <div className="flex gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <Bot size={16} />
            </span>
            <span className="flex items-center gap-1 rounded-2xl border border-[var(--line)] bg-white px-4 py-3">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </span>
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="flex items-end gap-2 border-t border-[var(--line)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder={mode === "study" ? "Ask about a topic, or say “quiz me”…" : "Ask a question… (Enter to send, Shift+Enter for a new line)"}
          className="max-h-32 min-h-[42px] flex-1 resize-none rounded-lg border border-[var(--line)] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
        />
        <button
          disabled={busy || !input.trim()}
          className="flex h-[42px] items-center gap-1.5 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          <Send size={15} /> Send
        </button>
      </form>
    </div>
  );
}
