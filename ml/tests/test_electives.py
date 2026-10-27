from __future__ import annotations

from edubase_ml.electives import (
    ElectiveCandidate,
    compute_collaborative_score,
    compute_content_score,
    rank_electives,
)


def test_compute_content_score():
    student_tags = {"ai", "machine learning", "python"}

    # Perfect overlap
    score, matching = compute_content_score(student_tags, ["AI", "Python"])
    assert score == 1.0
    assert matching == {"ai", "python"}

    # Partial overlap
    score, matching = compute_content_score(student_tags, ["ai", "robotics"])
    assert score == 0.5
    assert matching == {"ai"}

    # Zero overlap
    score, matching = compute_content_score(student_tags, ["biology", "chemistry"])
    assert score == 0.0
    assert matching == set()

    # Empty candidate tags
    score, matching = compute_content_score(student_tags, [])
    assert score == 0.0


def test_compute_collaborative_score():
    target_id = "s_target"
    peer_grades = {
        "s_target": {"c1": 9.0, "c2": 8.0},
        "s_peer1": {"c1": 9.0, "c2": 8.0, "c3": 10.0},  # identical vector, took c3
        "s_peer2": {"c1": 2.0, "c2": 3.0, "c3": 5.0},   # low similarity
    }

    score = compute_collaborative_score(target_id, "c3", peer_grades)
    assert score > 0.7  # Peer 1 has high similarity and gave c3 10.0


def test_rank_electives_hybrid():
    candidates = [
        ElectiveCandidate(
            id="c_nlp",
            code="CS401",
            title="Natural Language Processing",
            department_id="dept1",
            semester=6,
            tags=["AI", "NLP", "Python"],
        ),
        ElectiveCandidate(
            id="c_cloud",
            code="CS402",
            title="Cloud Architecture",
            department_id="dept1",
            semester=6,
            tags=["Cloud", "DevOps"],
        ),
        ElectiveCandidate(
            id="c_graphics",
            code="CS403",
            title="Computer Graphics",
            department_id="dept1",
            semester=6,
            tags=["Graphics", "OpenGL"],
        ),
    ]

    student_interests = ["ai", "python"]
    well_scored_tags = ["nlp"]

    peer_grades = {
        "s1": {"c_prev": 9.0},
        "s2": {"c_prev": 9.0, "c_nlp": 9.5},
    }

    recs = rank_electives(
        student_interests=student_interests,
        well_scored_course_tags=well_scored_tags,
        candidates=candidates,
        peer_grades=peer_grades,
        target_student_id="s1",
        top_n=2,
    )

    assert len(recs) == 2
    top = recs[0]
    assert top["course_id"] == "c_nlp"
    assert top["score"] > recs[1]["score"]
    assert "nlp" in top["reason"].lower() or "ai" in top["reason"].lower()
