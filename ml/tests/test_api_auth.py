from __future__ import annotations

from contextlib import contextmanager
from typing import Any
import pytest
from fastapi.testclient import TestClient

from edubase_ml.auth import AuthUser, get_current_user
from edubase_ml.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_dependency_overrides():
    app.dependency_overrides.clear()
    yield
    app.dependency_overrides.clear()


def test_public_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.parametrize(
    "method,endpoint,json_body",
    [
        ("POST", "/predict/performance", {}),
        ("POST", "/allocate/rooms/term_123", None),
        ("POST", "/kb/reindex", None),
        ("POST", "/recommend/electives/student_1", None),
        ("POST", "/recommend/placement/student_1", None),
        ("POST", "/chat", {"message": "hello"}),
    ],
)
def test_endpoints_return_401_without_token(method: str, endpoint: str, json_body: Any):
    # Missing authorization header completely
    if method == "POST":
        res = client.post(endpoint, json=json_body)
    else:
        res = client.get(endpoint)
    assert res.status_code == 401, f"{endpoint} expected 401, got {res.status_code}"


def test_endpoints_return_401_with_invalid_token_header():
    # Invalid auth scheme (not Bearer)
    res = client.post(
        "/predict/performance",
        headers={"Authorization": "Basic somecredentials"},
        json={},
    )
    assert res.status_code == 401


@pytest.mark.parametrize(
    "role",
    ["student", "alumni", "STUDENT", "Alumni"],
)
def test_staff_endpoints_return_403_for_non_staff(role: str):
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="user_non_staff",
        email="user@univ.edu",
        role=role,
        student_id="student_1",
    )

    res_perf = client.post("/predict/performance", json={})
    assert res_perf.status_code == 403

    res_alloc = client.post("/allocate/rooms/term_123")
    assert res_alloc.status_code == 403

    res_kb = client.post("/kb/reindex")
    assert res_kb.status_code == 403


def test_staff_endpoints_allowed_for_staff(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="faculty_1",
        email="prof@univ.edu",
        role="faculty",
    )

    monkeypatch.setattr(
        "edubase_ml.main.run_performance_predictions",
        lambda term_id: {"total": 5, "term_id": term_id},
    )
    monkeypatch.setattr(
        "edubase_ml.main.allocate_rooms_for_term",
        lambda term_id: {"status": "success", "assignments": []},
    )
    monkeypatch.setattr(
        "edubase_ml.main.reindex_kb_documents",
        lambda: {"status": "ok", "reindexed_count": 0},
    )

    res_perf = client.post("/predict/performance", json={"term_id": "t1"})
    assert res_perf.status_code == 200
    assert res_perf.json()["total"] == 5

    res_alloc = client.post("/allocate/rooms/t1")
    assert res_alloc.status_code == 200

    res_kb = client.post("/kb/reindex")
    assert res_kb.status_code == 200


def test_student_recommendations_allowed_own_forbidden_other(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="user_student_1",
        email="student1@univ.edu",
        role="student",
        student_id="student_1",
    )

    monkeypatch.setattr(
        "edubase_ml.main.recommend_electives_for_student",
        lambda s_id: [{"course_id": "c1", "score": 0.9}],
    )
    monkeypatch.setattr(
        "edubase_ml.main.recommend_placement_prep",
        lambda s_id: [{"skill": "Python", "impact": 10.0}],
    )

    # Own student ID -> 200 OK
    res_elec_own = client.post("/recommend/electives/student_1")
    assert res_elec_own.status_code == 200
    assert len(res_elec_own.json()) == 1

    res_plac_own = client.post("/recommend/placement/student_1")
    assert res_plac_own.status_code == 200
    assert len(res_plac_own.json()) == 1

    # Other student ID -> 403 Forbidden
    res_elec_other = client.post("/recommend/electives/student_other")
    assert res_elec_other.status_code == 403

    res_plac_other = client.post("/recommend/placement/student_other")
    assert res_plac_other.status_code == 403


def test_staff_allowed_any_student_recommendations(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="admin_1",
        email="admin@univ.edu",
        role="admin",
        student_id=None,
    )

    monkeypatch.setattr(
        "edubase_ml.main.recommend_electives_for_student",
        lambda s_id: [{"course_id": "c1"}],
    )
    monkeypatch.setattr(
        "edubase_ml.main.recommend_placement_prep",
        lambda s_id: [{"skill": "Docker"}],
    )

    res_elec = client.post("/recommend/electives/student_any")
    assert res_elec.status_code == 200

    res_plac = client.post("/recommend/placement/student_any")
    assert res_plac.status_code == 200


def test_chat_session_ownership_api_404(monkeypatch):
    app.dependency_overrides[get_current_user] = lambda: AuthUser(
        user_id="caller_profile_id",
        email="caller@univ.edu",
        role="student",
        student_id="student_1",
    )

    # Fake connection where session foreign_session belongs to someone else
    # and session nonexistent does not exist
    class FakeDBCursor:
        def __init__(self, query_map):
            self.query_map = query_map
            self._res = []

        def execute(self, query, params=None):
            if "chat_sessions" in query and "SELECT" in query:
                sess_id = params[0] if params else ""
                if sess_id == "foreign_session":
                    self._res = [{"profile_id": "other_owner_id"}]
                elif sess_id == "my_session":
                    self._res = [{"profile_id": "caller_profile_id"}]
                else:
                    self._res = []
            elif "chat_messages" in query and "SELECT" in query:
                self._res = []
            else:
                self._res = []

        def fetchone(self):
            return self._res[0] if self._res else None

        def fetchall(self):
            return self._res

        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    class FakeDBConn:
        def cursor(self):
            return FakeDBCursor({})

        def commit(self):
            pass

    @contextmanager
    def fake_get_connection():
        yield FakeDBConn()

    monkeypatch.setattr("edubase_ml.assistant.get_connection", fake_get_connection)
    monkeypatch.setattr(
        "edubase_ml.assistant.run_assistant_loop",
        lambda client, msgs, user, conn: "Assistant response",
    )

    # 1. Foreign session -> 404
    res_foreign = client.post(
        "/chat",
        json={"message": "hello", "session_id": "foreign_session"},
    )
    assert res_foreign.status_code == 404

    # 2. Nonexistent session -> 404
    res_nonexistent = client.post(
        "/chat",
        json={"message": "hello", "session_id": "nonexistent_session"},
    )
    assert res_nonexistent.status_code == 404

    # 3. Own session -> 200
    res_own = client.post(
        "/chat",
        json={"message": "hello", "session_id": "my_session"},
    )
    assert res_own.status_code == 200
    assert res_own.json()["response"] == "Assistant response"
