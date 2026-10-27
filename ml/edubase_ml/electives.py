from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any
import numpy as np

from .db import get_connection

ELECTIVE_MODEL_VERSION = "hybrid_elective_v1.0.0"


@dataclass
class ElectiveCandidate:
    id: str
    code: str
    title: str
    department_id: str
    semester: int
    tags: list[str]


def compute_content_score(
    student_tags: set[str],
    candidate_tags: list[str],
) -> tuple[float, set[str]]:
    """Compute normalized tag overlap between student profile and elective tags."""
    c_tags_lower = {t.lower() for t in candidate_tags}
    s_tags_lower = {t.lower() for t in student_tags}
    if not c_tags_lower:
        return 0.0, set()
    intersection = s_tags_lower & c_tags_lower
    overlap_ratio = len(intersection) / len(c_tags_lower)
    return min(1.0, overlap_ratio), intersection


def compute_collaborative_score(
    target_student_id: str,
    candidate_course_id: str,
    peer_grades: dict[str, dict[str, float]],  # student_id -> {course_id: grade_point}
) -> float:
    """Compute collaborative filtering score using cosine similarity on student grade vectors."""
    target_vector = peer_grades.get(target_student_id, {})
    if not target_vector:
        return 0.0

    target_courses = set(target_vector.keys())
    target_norm = np.sqrt(sum(v**2 for v in target_vector.values()))
    if target_norm == 0:
        return 0.0

    weighted_score_sum = 0.0
    sim_weight_sum = 0.0

    for peer_id, peer_vector in peer_grades.items():
        if peer_id == target_student_id:
            continue
        if candidate_course_id not in peer_vector:
            continue

        # Cosine similarity over common courses
        common = target_courses & set(peer_vector.keys())
        if not common:
            continue

        dot_prod = sum(target_vector[c] * peer_vector[c] for c in common)
        peer_norm = np.sqrt(sum(peer_vector[c] ** 2 for c in common))
        if peer_norm == 0:
            continue

        sim = dot_prod / (target_norm * peer_norm)
        if sim > 0:
            rating = peer_vector.get(candidate_course_id, 7.0) / 10.0
            weighted_score_sum += sim * rating
            sim_weight_sum += sim

    if sim_weight_sum > 0:
        return float(weighted_score_sum / sim_weight_sum)
    return 0.0


def rank_electives(
    student_interests: list[str],
    well_scored_course_tags: list[str],
    candidates: list[ElectiveCandidate],
    peer_grades: dict[str, dict[str, float]],
    target_student_id: str,
    top_n: int = 5,
) -> list[dict[str, Any]]:
    """Hybrid ranking of elective candidates combining content and collaborative signals."""
    student_tags = set(student_interests) | set(well_scored_course_tags)
    scored_candidates = []

    for c in candidates:
        content_score, matching_tags = compute_content_score(student_tags, c.tags)
        collab_score = compute_collaborative_score(target_student_id, c.id, peer_grades)

        if collab_score > 0 and content_score > 0:
            hybrid = 0.6 * content_score + 0.4 * collab_score
            tags_str = ", ".join(sorted(matching_tags)[:2])
            reason = f"Matches your interest in {tags_str} and popular among peer students with similar academic profile."
        elif content_score > 0:
            hybrid = content_score
            tags_str = ", ".join(sorted(matching_tags)[:2])
            reason = f"Matches your strengths and interest in {tags_str}."
        elif collab_score > 0:
            hybrid = collab_score * 0.7
            reason = "Highly rated by peer students with similar academic background."
        else:
            hybrid = 0.1
            reason = "Recommended elective for your semester."

        scored_candidates.append({
            "course_id": c.id,
            "code": c.code,
            "title": c.title,
            "score": round(float(hybrid), 4),
            "reason": reason,
        })

    scored_candidates.sort(key=lambda x: x["score"], reverse=True)
    return scored_candidates[:top_n]


def recommend_electives_for_student(student_id: str) -> list[dict[str, Any]]:
    """Fetch student context, candidate electives from DB, compute hybrid rank, save to DB."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Fetch student info
            cur.execute(
                """
                SELECT s.id, s.current_semester, s.interests, p.department_id
                FROM public.students s
                JOIN public.programs p ON p.id = s.program_id
                WHERE s.id = %s
                """,
                (student_id,),
            )
            student_row = cur.fetchone()
            if not student_row:
                return []

            current_sem = student_row["current_semester"]
            dept_id = str(student_row["department_id"])
            interests = list(student_row.get("interests") or [])

            # 2. Courses already taken by student
            cur.execute(
                """
                SELECT cs.course_id, e.grade_point, c.tags
                FROM public.enrollments e
                JOIN public.course_sections cs ON cs.id = e.section_id
                JOIN public.courses c ON c.id = cs.course_id
                WHERE e.student_id = %s
                """,
                (student_id,),
            )
            taken_rows = cur.fetchall()
            taken_course_ids = {str(r["course_id"]) for r in taken_rows}

            well_scored_tags: list[str] = []
            for r in taken_rows:
                gp = r.get("grade_point")
                if gp is not None and float(gp) >= 8.0:
                    for t in (r.get("tags") or []):
                        well_scored_tags.append(t)

            # 3. Eligible candidate electives
            cur.execute(
                """
                SELECT id, code, title, department_id, semester, tags
                FROM public.courses
                WHERE is_elective = true
                  AND department_id = %s
                  AND semester >= %s
                """,
                (dept_id, current_sem),
            )
            elective_rows = cur.fetchall()

            candidates = [
                ElectiveCandidate(
                    id=str(r["id"]),
                    code=r["code"],
                    title=r["title"],
                    department_id=str(r["department_id"]),
                    semester=r["semester"],
                    tags=list(r.get("tags") or []),
                )
                for r in elective_rows
                if str(r["id"]) not in taken_course_ids
            ]

            # 4. Peer grade vectors for collaborative filtering
            cur.execute(
                """
                SELECT e.student_id, cs.course_id, e.grade_point
                FROM public.enrollments e
                JOIN public.course_sections cs ON cs.id = e.section_id
                WHERE e.grade_point IS NOT NULL
                """
            )
            all_grades = cur.fetchall()
            peer_grades: dict[str, dict[str, float]] = {}
            for r in all_grades:
                s_id = str(r["student_id"])
                c_id = str(r["course_id"])
                gp = float(r["grade_point"])
                if s_id not in peer_grades:
                    peer_grades[s_id] = {}
                peer_grades[s_id][c_id] = gp

        # Compute recommendations
        top_electives = rank_electives(
            student_interests=interests,
            well_scored_course_tags=well_scored_tags,
            candidates=candidates,
            peer_grades=peer_grades,
            target_student_id=student_id,
            top_n=5,
        )

        # 5. Persist recommendations
        with conn.cursor() as cur:
            for item in top_electives:
                payload = {
                    "course_id": item["course_id"],
                    "code": item["code"],
                    "title": item["title"],
                    "reason": item["reason"],
                }
                cur.execute(
                    """
                    INSERT INTO public.recommendations
                        (student_id, kind, payload, score, model_version)
                    VALUES (%s, 'elective', %s, %s, %s)
                    """,
                    (
                        student_id,
                        json.dumps(payload),
                        item["score"],
                        ELECTIVE_MODEL_VERSION,
                    ),
                )
        conn.commit()

    return top_electives
