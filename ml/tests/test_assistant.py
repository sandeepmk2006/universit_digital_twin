from __future__ import annotations

from dataclasses import dataclass
from contextlib import contextmanager
from typing import Any
import pytest
from fastapi import HTTPException
from edubase_ml.assistant import chat_turn, dispatch_tool_call, run_assistant_loop
from edubase_ml.auth import AuthUser


class FakeCursor:
    def __init__(self, data_map: dict[str, list[dict[str, Any]]]):
        self.data_map = data_map
        self.last_query = ""
        self._current_result: list[dict[str, Any]] = []

    def execute(self, query: str, params: Any = None):
        self.last_query = query
        for key, rows in self.data_map.items():
            if key in query:
                self._current_result = rows
                return
        self._current_result = []

    def fetchall(self) -> list[dict[str, Any]]:
        return self._current_result

    def fetchone(self) -> dict[str, Any] | None:
        return self._current_result[0] if self._current_result else None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


class FakeConnection:
    def __init__(self, data_map: dict[str, list[dict[str, Any]]]):
        self.data_map = data_map

    def cursor(self):
        return FakeCursor(self.data_map)

    def commit(self):
        pass


@dataclass
class FakeTextBlock:
    text: str
    type: str = "text"


@dataclass
class FakeToolUseBlock:
    id: str
    name: str
    input: dict[str, Any]
    type: str = "tool_use"


@dataclass
class FakeAnthropicResponse:
    content: list[Any]
    stop_reason: str


class FakeAnthropicMessages:
    def __init__(self, responses: list[FakeAnthropicResponse]):
        self.responses = responses
        self.call_count = 0
        self.received_messages: list[list[dict[str, Any]]] = []

    def create(self, **kwargs) -> FakeAnthropicResponse:
        self.received_messages.append(kwargs.get("messages", []))
        resp = self.responses[self.call_count]
        self.call_count += 1
        return resp


class FakeAnthropicClient:
    def __init__(self, responses: list[FakeAnthropicResponse]):
        self.messages = FakeAnthropicMessages(responses)


def test_dispatch_tool_calls_with_fake_db():
    fake_user = AuthUser(
        user_id="user_123",
        email="student@univ.edu",
        role="student",
        student_id="student_123",
    )

    data_map = {
        "attendance_records": [
            {"code": "CS101", "title": "Data Structures", "section": "A", "total_sessions": 20, "attended": 18, "percentage": 90.0}
        ],
        "timetable_slots": [
            {"weekday": 1, "starts_at": "09:00:00", "ends_at": "10:00:00", "code": "CS101", "title": "Data Structures", "section": "A", "room_code": "R101"}
        ],
        "marks": [
            {"code": "CS101", "exam_kind": "internal_1", "obtained": 22.0, "max_marks": 25.0, "weightage": 20.0}
        ],
        "events": [
            {"title": "Hackathon 2026", "starts_at": "2026-11-01 09:00:00", "ends_at": "2026-11-02 18:00:00", "description": "Annual 24h hackathon", "capacity": 200}
        ],
        "bus_routes": [
            {"route_code": "R1", "route_name": "City Express", "stop_name": "Central Station", "seq": 1, "pickup_at": "07:30:00"}
        ],
        "kb_documents": [
            {"title": "Leave Policy", "content": "Medical leaves must be approved by the warden."}
        ],
    }

    conn = FakeConnection(data_map)

    # Attendance
    att_res = dispatch_tool_call("my_attendance", {}, fake_user, conn)
    assert "CS101" in att_res
    assert "90.0%" in att_res

    # Timetable
    tt_res = dispatch_tool_call("my_timetable", {"weekday": 1}, fake_user, conn)
    assert "CS101" in tt_res
    assert "Mon" in tt_res
    assert "R101" in tt_res

    # Results
    res_res = dispatch_tool_call("my_results", {}, fake_user, conn)
    assert "internal_1" in res_res

    # Upcoming events
    ev_res = dispatch_tool_call("upcoming_events", {}, fake_user, conn)
    assert "Hackathon 2026" in ev_res

    # Bus routes
    bus_res = dispatch_tool_call("bus_routes", {}, fake_user, conn)
    assert "City Express" in bus_res

    # Campus knowledge
    kb_res = dispatch_tool_call("search_campus_knowledge", {"query": "leave policy"}, fake_user, conn)
    assert "Leave Policy" in kb_res


def test_run_assistant_loop_with_tool_call_and_fake_anthropic():
    fake_user = AuthUser(
        user_id="user_123",
        email="student@univ.edu",
        role="student",
        student_id="student_123",
    )

    data_map = {
        "attendance_records": [
            {"code": "CS101", "title": "Data Structures", "section": "A", "total_sessions": 20, "attended": 18, "percentage": 90.0}
        ]
    }
    conn = FakeConnection(data_map)

    responses = [
        # Round 1: Model requests my_attendance tool call
        FakeAnthropicResponse(
            content=[
                FakeToolUseBlock(
                    id="tool_1",
                    name="my_attendance",
                    input={},
                )
            ],
            stop_reason="tool_use",
        ),
        # Round 2: Model gives final answer
        FakeAnthropicResponse(
            content=[
                FakeTextBlock(text="Your attendance for CS101 Data Structures is 90.0% (18/20 sessions attended).")
            ],
            stop_reason="end_turn",
        ),
    ]

    client = FakeAnthropicClient(responses)
    messages = [{"role": "user", "content": "What is my attendance?"}]

    final_reply = run_assistant_loop(client, messages, fake_user, conn)

    assert "CS101 Data Structures is 90.0%" in final_reply
    assert client.messages.call_count == 2
    # Verify that tool result was fed back to Anthropic in round 2
    round_2_messages = client.messages.received_messages[1]
    last_msg = round_2_messages[-1]
    assert last_msg["role"] == "user"
    assert last_msg["content"][0]["type"] == "tool_result"
    assert "90.0%" in last_msg["content"][0]["content"]


def test_chat_turn_session_ownership_mismatch_raises_404(monkeypatch):
    data_map = {
        "chat_sessions": [{"profile_id": "other_profile_id"}],
    }
    fake_conn = FakeConnection(data_map)

    @contextmanager
    def fake_get_conn():
        yield fake_conn

    monkeypatch.setattr("edubase_ml.assistant.get_connection", fake_get_conn)
    user = AuthUser(user_id="my_profile_id", email="student@univ.edu")

    with pytest.raises(HTTPException) as exc_info:
        chat_turn("hello", "session_foreign", user)
    assert exc_info.value.status_code == 404


def test_chat_turn_session_not_found_raises_404(monkeypatch):
    data_map = {
        "chat_sessions": [],
    }
    fake_conn = FakeConnection(data_map)

    @contextmanager
    def fake_get_conn():
        yield fake_conn

    monkeypatch.setattr("edubase_ml.assistant.get_connection", fake_get_conn)
    user = AuthUser(user_id="my_profile_id", email="student@univ.edu")

    with pytest.raises(HTTPException) as exc_info:
        chat_turn("hello", "nonexistent_session", user)
    assert exc_info.value.status_code == 404


def test_chat_turn_session_ownership_success(monkeypatch):
    data_map = {
        "chat_sessions": [{"profile_id": "my_profile_id"}],
        "chat_messages": [],
    }
    fake_conn = FakeConnection(data_map)

    @contextmanager
    def fake_get_conn():
        yield fake_conn

    monkeypatch.setattr("edubase_ml.assistant.get_connection", fake_get_conn)
    user = AuthUser(user_id="my_profile_id", email="student@univ.edu")
    client = FakeAnthropicClient([
        FakeAnthropicResponse(
            content=[FakeTextBlock("Verified chat response")],
            stop_reason="end_turn",
        )
    ])

    result = chat_turn("hello", "my_session_1", user, client=client)
    assert result["session_id"] == "my_session_1"
    assert result["response"] == "Verified chat response"

