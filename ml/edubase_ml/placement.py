from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .db import get_connection

PLACEMENT_MODEL_VERSION = "placement_gap_v1.0.0"


@dataclass
class DriveInfo:
    id: str
    company_name: str
    role_title: str
    package_lpa: float
    min_cgpa: float
    required_skills: list[str]
    eligible_programs: list[str]
    status: str = "upcoming"


def analyze_placement_gaps(
    student_cgpa: float,
    student_program_id: str | None,
    student_skills: list[str],
    drives: list[DriveInfo],
) -> list[dict[str, Any]]:
    """Compare student skills against upcoming eligible drives weighted by package_lpa.

    Returns skill gaps sorted by impact with unlocked drives.
    """
    known_skills = {s.strip().lower() for s in student_skills}

    # Filter upcoming drives where student is eligible by CGPA and program
    eligible_drives: list[DriveInfo] = []
    for d in drives:
        if d.status != "upcoming":
            continue
        if student_cgpa < d.min_cgpa:
            continue
        if d.eligible_programs and student_program_id and student_program_id not in d.eligible_programs:
            continue
        eligible_drives.append(d)

    skill_impact: dict[str, float] = {}
    skill_drives: dict[str, list[dict[str, Any]]] = {}
    canonical_skill_names: dict[str, str] = {}

    for d in eligible_drives:
        weight = float(d.package_lpa) if d.package_lpa and d.package_lpa > 0 else 5.0
        for skill in d.required_skills:
            normalized = skill.strip().lower()
            if not normalized or normalized in known_skills:
                continue

            if normalized not in canonical_skill_names:
                canonical_skill_names[normalized] = skill.strip()

            skill_impact[normalized] = skill_impact.get(normalized, 0.0) + weight
            if normalized not in skill_drives:
                skill_drives[normalized] = []

            skill_drives[normalized].append({
                "drive_id": d.id,
                "company_name": d.company_name,
                "role_title": d.role_title,
                "package_lpa": d.package_lpa,
            })

    # Build results sorted by impact descending
    gaps: list[dict[str, Any]] = []
    for norm_skill, impact in sorted(skill_impact.items(), key=lambda x: x[1], reverse=True):
        skill_name = canonical_skill_names[norm_skill]
        unlocked = skill_drives[norm_skill]
        max_lpa = max((d["package_lpa"] for d in unlocked), default=0.0)
        top_company = unlocked[0]["company_name"] if unlocked else "Top companies"
        top_role = unlocked[0]["role_title"] if unlocked else "Role"

        reason = (
            f"Required by {len(unlocked)} drive(s) offering up to {max_lpa:.1f} LPA "
            f"(e.g., {top_company} - {top_role})."
        )

        gaps.append({
            "skill": skill_name,
            "impact": round(impact, 2),
            "reason": reason,
            "unlocked_drives": unlocked,
        })

    return gaps


def recommend_placement_prep(student_id: str) -> list[dict[str, Any]]:
    """Analyze DB placement drives and student skills, store and return skill gap recommendations."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            # 1. Fetch student
            cur.execute(
                "SELECT id, program_id, cgpa FROM public.students WHERE id = %s",
                (student_id,),
            )
            student_row = cur.fetchone()
            if not student_row:
                return []

            student_cgpa = float(student_row["cgpa"] or 0.0)
            student_program_id = str(student_row["program_id"]) if student_row["program_id"] else None

            # 2. Fetch student skills
            cur.execute(
                "SELECT skill FROM public.student_skills WHERE student_id = %s",
                (student_id,),
            )
            skill_rows = cur.fetchall()
            student_skills = [r["skill"] for r in skill_rows]

            # 3. Fetch upcoming placement drives with company names
            cur.execute(
                """
                SELECT d.id, d.role_title, d.package_lpa, d.min_cgpa, d.required_skills,
                       d.eligible_programs, d.status, c.name as company_name
                FROM public.placement_drives d
                JOIN public.companies c ON c.id = d.company_id
                WHERE d.status = 'upcoming'
                """
            )
            drive_rows = cur.fetchall()

            drives = [
                DriveInfo(
                    id=str(r["id"]),
                    company_name=r["company_name"],
                    role_title=r["role_title"],
                    package_lpa=float(r["package_lpa"] or 0.0),
                    min_cgpa=float(r["min_cgpa"] or 0.0),
                    required_skills=list(r.get("required_skills") or []),
                    eligible_programs=[str(p) for p in (r.get("eligible_programs") or [])],
                    status=r["status"],
                )
                for r in drive_rows
            ]

        # Compute gaps
        gaps = analyze_placement_gaps(student_cgpa, student_program_id, student_skills, drives)

        # 4. Save to recommendations table
        with conn.cursor() as cur:
            for g in gaps:
                payload = {
                    "skill": g["skill"],
                    "impact": g["impact"],
                    "reason": g["reason"],
                    "unlocked_drives": g["unlocked_drives"],
                }
                cur.execute(
                    """
                    INSERT INTO public.recommendations
                        (student_id, kind, payload, score, model_version)
                    VALUES (%s, 'placement_prep', %s, %s, %s)
                    """,
                    (
                        student_id,
                        json.dumps(payload),
                        g["impact"],
                        PLACEMENT_MODEL_VERSION,
                    ),
                )
        conn.commit()

    return gaps
