from __future__ import annotations

import json
from typing import Any
import anthropic
from fastapi import HTTPException, status
import httpx

from .auth import AuthUser
from .config import settings
from .db import get_connection

SYSTEM_PROMPT = (
    "You are the EduBase campus assistant. Answer questions using only the factual information "
    "provided in tool call results. If the requested information is not available in the tool results, "
    "clearly say so. Always be concise, helpful, and polite."
)

TOOL_DEFINITIONS = [
    {
        "name": "search_campus_knowledge",
        "description": "Search campus knowledge base policies, FAQs, and documentation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query or question."}
            },
            "required": ["query"],
        },
    },
    {
        "name": "my_attendance",
        "description": "Get the authenticated student's attendance records and percentages.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "my_timetable",
        "description": "Get the authenticated student's class timetable schedule.",
        "input_schema": {
            "type": "object",
            "properties": {
                "weekday": {
                    "type": "integer",
                    "description": "Optional weekday (1=Monday, 2=Tuesday, ..., 6=Saturday)",
                }
            },
        },
    },
    {
        "name": "my_results",
        "description": "Get the authenticated student's exam marks, grades, and GPA.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "upcoming_events",
        "description": "List upcoming campus events and registrations.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "bus_routes",
        "description": "List university bus routes and stop schedules.",
        "input_schema": {"type": "object", "properties": {}},
    },
]


def get_voyage_embeddings(texts: list[str], api_key: str) -> list[list[float]]:
    """Fetch 1024-dim embeddings from Voyage AI API (voyage-3 model)."""
    resp = httpx.post(
        "https://api.voyageai.com/v1/embeddings",
        headers={"Authorization": f"Bearer {api_key}"},
        json={"model": "voyage-3", "input": texts},
        timeout=20.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return [item["embedding"] for item in data["data"]]


def search_knowledge_base(query: str, conn: Any) -> str:
    """Search KB documents using pgvector when VOYAGE_API_KEY is configured, else Postgres FTS."""
    if not query.strip():
        return "No search query provided."

    with conn.cursor() as cur:
        if settings.VOYAGE_API_KEY:
            try:
                embeddings = get_voyage_embeddings([query], settings.VOYAGE_API_KEY)
                emb_str = f"[{','.join(map(str, embeddings[0]))}]"
                cur.execute(
                    "SELECT title, content, similarity FROM public.match_kb_documents(%s::extensions.vector, 5)",
                    (emb_str,),
                )
                rows = cur.fetchall()
                if rows:
                    return "\n\n".join(
                        f"Title: {r['title']}\nContent: {r['content']} (similarity: {float(r.get('similarity', 0.0)):.2f})"
                        for r in rows
                    )
            except Exception:
                # Fall back to full-text search on embedding failure
                pass

        # Postgres Full-Text Search fallback
        cur.execute(
            """
            SELECT title, content,
                   ts_rank(to_tsvector('english', title || ' ' || content), plainto_tsquery('english', %s)) as rank
            FROM public.kb_documents
            WHERE to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', %s)
               OR title ILIKE %s
               OR content ILIKE %s
            ORDER BY rank DESC
            LIMIT 5
            """,
            (query, query, f"%{query}%", f"%{query}%"),
        )
        rows = cur.fetchall()
        if not rows:
            return "No matching knowledge base documents found."
        return "\n\n".join(f"Title: {r['title']}\nContent: {r['content']}" for r in rows)


def dispatch_tool_call(
    tool_name: str,
    tool_input: dict[str, Any],
    user: AuthUser,
    conn: Any,
) -> str:
    """Execute requested tool safely scoped to the authenticated student's rows."""
    if tool_name == "search_campus_knowledge":
        query = str(tool_input.get("query", ""))
        return search_knowledge_base(query, conn)

    if tool_name == "upcoming_events":
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT title, description, starts_at, ends_at, capacity
                FROM public.events
                WHERE starts_at >= now()
                ORDER BY starts_at ASC
                LIMIT 10
                """
            )
            rows = cur.fetchall()
            if not rows:
                return "No upcoming campus events scheduled."
            return "\n".join(
                f"- {r['title']} ({r['starts_at']} to {r['ends_at']}): {r.get('description') or 'No description'}"
                for r in rows
            )

    if tool_name == "bus_routes":
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.code as route_code, r.name as route_name,
                       s.name as stop_name, s.seq, s.pickup_at
                FROM public.bus_routes r
                JOIN public.bus_stops s ON s.route_id = r.id
                ORDER BY r.code, s.seq
                """
            )
            rows = cur.fetchall()
            if not rows:
                return "No bus routes available."
            lines = [f"Route {r['route_code']} - {r['route_name']}: Stop #{r['seq']} {r['stop_name']} at {r['pickup_at']}" for r in rows]
            return "\n".join(lines)

    # Personal tools require an active student ID
    if not user.student_id:
        return "Personal student record not found for this authenticated user."

    if tool_name == "my_attendance":
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.code, c.title, cs.section,
                       count(*) as total_sessions,
                       count(*) filter (where ar.status in ('present', 'late')) as attended,
                       round(100.0 * count(*) filter (where ar.status in ('present', 'late')) / nullif(count(*), 0), 1) as percentage
                FROM public.attendance_records ar
                JOIN public.attendance_sessions s ON s.id = ar.session_id
                JOIN public.course_sections cs ON cs.id = s.section_id
                JOIN public.courses c ON c.id = cs.course_id
                WHERE ar.student_id = %s
                GROUP BY c.code, c.title, cs.section
                """,
                (user.student_id,),
            )
            rows = cur.fetchall()
            if not rows:
                return "No attendance records found for your courses."
            return "\n".join(
                f"- {r['code']} ({r['title']}, Sec {r['section']}): {r['attended']}/{r['total_sessions']} attended ({r['percentage']}%)"
                for r in rows
            )

    if tool_name == "my_timetable":
        weekday = tool_input.get("weekday")
        with conn.cursor() as cur:
            if weekday is not None:
                cur.execute(
                    """
                    SELECT t.weekday, t.starts_at, t.ends_at, c.code, c.title, cs.section, r.code as room_code
                    FROM public.enrollments e
                    JOIN public.course_sections cs ON cs.id = e.section_id
                    JOIN public.courses c ON c.id = cs.course_id
                    JOIN public.timetable_slots t ON t.section_id = cs.id
                    LEFT JOIN public.rooms r ON r.id = t.room_id
                    WHERE e.student_id = %s AND t.weekday = %s
                    ORDER BY t.starts_at
                    """,
                    (user.student_id, int(weekday)),
                )
            else:
                cur.execute(
                    """
                    SELECT t.weekday, t.starts_at, t.ends_at, c.code, c.title, cs.section, r.code as room_code
                    FROM public.enrollments e
                    JOIN public.course_sections cs ON cs.id = e.section_id
                    JOIN public.courses c ON c.id = cs.course_id
                    JOIN public.timetable_slots t ON t.section_id = cs.id
                    LEFT JOIN public.rooms r ON r.id = t.room_id
                    WHERE e.student_id = %s
                    ORDER BY t.weekday, t.starts_at
                    """,
                    (user.student_id,),
                )
            rows = cur.fetchall()
            if not rows:
                day_str = f" for weekday {weekday}" if weekday else ""
                return f"No scheduled classes found{day_str}."
            days = {1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat"}
            return "\n".join(
                f"- {days.get(r['weekday'], r['weekday'])} {r['starts_at']}-{r['ends_at']}: {r['code']} {r['title']} (Sec {r['section']}, Room {r['room_code'] or 'TBD'})"
                for r in rows
            )

    if tool_name == "my_results":
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT c.code, c.title, e.kind as exam_kind, m.obtained, e.max_marks, e.weightage
                FROM public.marks m
                JOIN public.exams e ON e.id = m.exam_id
                JOIN public.course_sections cs ON cs.id = e.section_id
                JOIN public.courses c ON c.id = cs.course_id
                WHERE m.student_id = %s
                ORDER BY c.code, e.kind
                """,
                (user.student_id,),
            )
            exam_rows = cur.fetchall()

            cur.execute(
                """
                SELECT c.code, c.title, c.credits, e.grade, e.grade_point
                FROM public.enrollments e
                JOIN public.course_sections cs ON cs.id = e.section_id
                JOIN public.courses c ON c.id = cs.course_id
                WHERE e.student_id = %s AND e.grade IS NOT NULL
                """,
                (user.student_id,),
            )
            grade_rows = cur.fetchall()

            res: list[str] = []
            if grade_rows:
                res.append("Course Grades:")
                for g in grade_rows:
                    res.append(f"  {g['code']} {g['title']}: Grade {g['grade']} (GP {g['grade_point']}, Credits {g['credits']})")
            if exam_rows:
                res.append("Exam Marks:")
                for m in exam_rows:
                    res.append(f"  {m['code']} {m['exam_kind']}: {m['obtained']}/{m['max_marks']} (Weightage {m['weightage']}%)")
            return "\n".join(res) if res else "No marks or grade records found."

    return f"Unknown tool: {tool_name}"


def run_assistant_loop(
    client: Any,
    messages: list[dict[str, Any]],
    user: AuthUser,
    conn: Any,
    max_rounds: int = 6,
) -> str:
    """Run Anthropic tool call loop until end_turn or max_rounds reached."""
    current_messages = list(messages)

    for _ in range(max_rounds):
        response = client.messages.create(
            model="claude-sonnet-5-5",
            max_tokens=1024,
            system=SYSTEM_PROMPT,
            messages=current_messages,
            tools=TOOL_DEFINITIONS,
        )

        tool_calls = [c for c in response.content if getattr(c, "type", None) == "tool_use"]
        text_blocks = [c.text for c in response.content if getattr(c, "type", None) == "text"]

        if response.stop_reason == "end_turn" or not tool_calls:
            return "".join(text_blocks).strip()

        # Append assistant response containing tool use
        current_messages.append({"role": "assistant", "content": response.content})

        # Execute tool calls and append user tool result blocks
        tool_results = []
        for call in tool_calls:
            result_str = dispatch_tool_call(call.name, call.input, user, conn)
            tool_results.append({
                "type": "tool_result",
                "tool_use_id": call.id,
                "content": result_str,
            })

        current_messages.append({"role": "user", "content": tool_results})

    return "".join(text_blocks).strip() if text_blocks else "I am unable to complete this request right now."


def chat_turn(
    message: str,
    session_id: str | None,
    user: AuthUser,
    client: Any | None = None,
) -> dict[str, Any]:
    """Execute single chat interaction, save messages to DB, and return response."""
    anthropic_client = client or anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY or "dummy")

    with get_connection() as conn:
        with conn.cursor() as cur:
            resolved_session_id = session_id
            if resolved_session_id:
                cur.execute(
                    "SELECT profile_id FROM public.chat_sessions WHERE id = %s",
                    (resolved_session_id,),
                )
                session_row = cur.fetchone()
                if not session_row or str(session_row["profile_id"]) != str(user.user_id):
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Chat session not found",
                    )
            else:
                cur.execute(
                    "INSERT INTO public.chat_sessions (profile_id) VALUES (%s) RETURNING id",
                    (user.user_id,),
                )
                session_row = cur.fetchone()
                resolved_session_id = str(session_row["id"])

            # Fetch recent conversation history for this session
            cur.execute(
                """
                SELECT role, content
                FROM public.chat_messages
                WHERE session_id = %s
                ORDER BY id ASC
                LIMIT 20
                """,
                (resolved_session_id,),
            )
            history_rows = cur.fetchall()

        messages: list[dict[str, Any]] = [
            {"role": r["role"], "content": r["content"]}
            for r in history_rows
        ]
        messages.append({"role": "user", "content": message})

        reply_text = run_assistant_loop(anthropic_client, messages, user, conn)

        # Persist conversation
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO public.chat_messages (session_id, role, content) VALUES (%s, 'user', %s)",
                (resolved_session_id, message),
            )
            cur.execute(
                "INSERT INTO public.chat_messages (session_id, role, content) VALUES (%s, 'assistant', %s)",
                (resolved_session_id, reply_text),
            )
        conn.commit()

    return {
        "session_id": resolved_session_id,
        "response": reply_text,
    }


def reindex_kb_documents() -> dict[str, Any]:
    """Embed kb_documents lacking embeddings when VOYAGE_API_KEY is configured."""
    if not settings.VOYAGE_API_KEY:
        return {
            "status": "skipped",
            "reason": "VOYAGE_API_KEY is not configured",
            "reindexed_count": 0,
        }

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, content FROM public.kb_documents WHERE embedding IS NULL"
            )
            rows = cur.fetchall()
            if not rows:
                return {"status": "ok", "reindexed_count": 0}

            texts = [f"{r['title']}\n\n{r['content']}" for r in rows]
            embeddings = get_voyage_embeddings(texts, settings.VOYAGE_API_KEY)

            for doc, emb in zip(rows, embeddings):
                emb_str = f"[{','.join(map(str, emb))}]"
                cur.execute(
                    """
                    UPDATE public.kb_documents
                    SET embedding = %s::extensions.vector, updated_at = now()
                    WHERE id = %s
                    """,
                    (emb_str, doc["id"]),
                )
        conn.commit()

    return {"status": "ok", "reindexed_count": len(rows)}
