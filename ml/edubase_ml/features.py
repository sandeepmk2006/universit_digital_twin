from __future__ import annotations

from typing import Any
import numpy as np
import pandas as pd
import psycopg


FEATURE_COLUMNS = [
    "attendance_pct",
    "internal_marks_pct",
    "lab_pct",
    "previous_cgpa",
    "credit_load",
    "late_ratio",
]


def compute_features_from_dataframes(
    df_students: pd.DataFrame,
    df_enrollments: pd.DataFrame,
    df_attendance: pd.DataFrame,
    df_marks: pd.DataFrame,
) -> pd.DataFrame:
    """Pure transformation of raw entity DataFrames into per-student ML feature frame."""
    if df_students.empty:
        return pd.DataFrame(columns=["student_id"] + FEATURE_COLUMNS + ["credit_weighted_gpa"])

    results: list[dict[str, Any]] = []

    for _, student in df_students.iterrows():
        s_id = str(student["id"])
        prev_cgpa = float(student["cgpa"]) if pd.notnull(student.get("cgpa")) else 7.0

        # Enrollments & credits
        if not df_enrollments.empty and "student_id" in df_enrollments.columns:
            s_enr = df_enrollments[df_enrollments["student_id"].astype(str) == s_id]
        else:
            s_enr = pd.DataFrame()

        credit_load = float(s_enr["credits"].sum()) if not s_enr.empty and "credits" in s_enr.columns else 20.0
        if credit_load <= 0:
            credit_load = 20.0

        # Target: credit-weighted GPA if grades available
        credit_weighted_gpa = np.nan
        if not s_enr.empty and "grade_point" in s_enr.columns and "credits" in s_enr.columns:
            graded = s_enr.dropna(subset=["grade_point"])
            if not graded.empty and graded["credits"].sum() > 0:
                credit_weighted_gpa = round(
                    float((graded["grade_point"] * graded["credits"]).sum() / graded["credits"].sum()),
                    2,
                )

        # Attendance & Late ratio
        if not df_attendance.empty and "student_id" in df_attendance.columns:
            s_att = df_attendance[df_attendance["student_id"].astype(str) == s_id]
        else:
            s_att = pd.DataFrame()

        total_sessions = len(s_att)
        if total_sessions > 0:
            attended = len(s_att[s_att["status"].isin(["present", "late"])])
            attendance_pct = round(100.0 * attended / total_sessions, 2)
            late_count = len(s_att[s_att["status"] == "late"])
            late_ratio = round(late_count / total_sessions, 4)
        else:
            attendance_pct = 85.0
            late_ratio = 0.0

        # Marks
        if not df_marks.empty and "student_id" in df_marks.columns:
            s_marks = df_marks[df_marks["student_id"].astype(str) == s_id]
        else:
            s_marks = pd.DataFrame()

        # internal_1, internal_2, assignment
        internal_kinds = ["internal_1", "internal_2", "assignment"]
        s_int = s_marks[s_marks["kind"].isin(internal_kinds)] if not s_marks.empty and "kind" in s_marks.columns else pd.DataFrame()
        if not s_int.empty and s_int["max_marks"].sum() > 0:
            internal_marks_pct = round(100.0 * float(s_int["obtained"].sum()) / float(s_int["max_marks"].sum()), 2)
        else:
            internal_marks_pct = round(prev_cgpa * 10.0, 2)

        # lab
        s_lab = s_marks[s_marks["kind"] == "lab"] if not s_marks.empty and "kind" in s_marks.columns else pd.DataFrame()
        if not s_lab.empty and s_lab["max_marks"].sum() > 0:
            lab_pct = round(100.0 * float(s_lab["obtained"].sum()) / float(s_lab["max_marks"].sum()), 2)
        else:
            lab_pct = internal_marks_pct

        results.append({
            "student_id": s_id,
            "attendance_pct": attendance_pct,
            "internal_marks_pct": internal_marks_pct,
            "lab_pct": lab_pct,
            "previous_cgpa": prev_cgpa,
            "credit_load": credit_load,
            "late_ratio": late_ratio,
            "credit_weighted_gpa": credit_weighted_gpa,
        })

    return pd.DataFrame(results)


def fetch_feature_data(conn: psycopg.Connection, term_id: str | None = None) -> pd.DataFrame:
    """Fetch data from PostgreSQL and return computed feature DataFrame."""
    with conn.cursor() as cur:
        resolved_term_id = term_id
        if not resolved_term_id:
            cur.execute("SELECT id FROM public.academic_terms WHERE is_current = true LIMIT 1")
            row = cur.fetchone()
            if row:
                resolved_term_id = str(row["id"])

        cur.execute("SELECT id, roll_no, full_name, cgpa, status FROM public.students WHERE status = 'active'")
        students = cur.fetchall()
        df_students = pd.DataFrame(students) if students else pd.DataFrame(columns=["id", "roll_no", "full_name", "cgpa", "status"])

        if resolved_term_id:
            cur.execute(
                """
                SELECT e.student_id, e.section_id, e.grade_point, c.credits
                FROM public.enrollments e
                JOIN public.course_sections cs ON cs.id = e.section_id
                JOIN public.courses c ON c.id = cs.course_id
                WHERE cs.term_id = %s
                """,
                (resolved_term_id,),
            )
            enrollments = cur.fetchall()

            cur.execute(
                """
                SELECT ar.student_id, ar.session_id, ar.status
                FROM public.attendance_records ar
                JOIN public.attendance_sessions s ON s.id = ar.session_id
                JOIN public.course_sections cs ON cs.id = s.section_id
                WHERE cs.term_id = %s
                """,
                (resolved_term_id,),
            )
            attendance = cur.fetchall()

            cur.execute(
                """
                SELECT m.student_id, m.obtained, ex.kind, ex.max_marks, ex.weightage
                FROM public.marks m
                JOIN public.exams ex ON ex.id = m.exam_id
                JOIN public.course_sections cs ON cs.id = ex.section_id
                WHERE cs.term_id = %s
                """,
                (resolved_term_id,),
            )
            marks = cur.fetchall()
        else:
            cur.execute(
                """
                SELECT e.student_id, e.section_id, e.grade_point, c.credits
                FROM public.enrollments e
                JOIN public.course_sections cs ON cs.id = e.section_id
                JOIN public.courses c ON c.id = cs.course_id
                """
            )
            enrollments = cur.fetchall()

            cur.execute(
                """
                SELECT ar.student_id, ar.session_id, ar.status
                FROM public.attendance_records ar
                JOIN public.attendance_sessions s ON s.id = ar.session_id
                """
            )
            attendance = cur.fetchall()

            cur.execute(
                """
                SELECT m.student_id, m.obtained, ex.kind, ex.max_marks, ex.weightage
                FROM public.marks m
                JOIN public.exams ex ON ex.id = m.exam_id
                """
            )
            marks = cur.fetchall()

        df_enrollments = pd.DataFrame(enrollments) if enrollments else pd.DataFrame(columns=["student_id", "section_id", "grade_point", "credits"])
        df_attendance = pd.DataFrame(attendance) if attendance else pd.DataFrame(columns=["student_id", "session_id", "status"])
        df_marks = pd.DataFrame(marks) if marks else pd.DataFrame(columns=["student_id", "obtained", "kind", "max_marks", "weightage"])

    return compute_features_from_dataframes(df_students, df_enrollments, df_attendance, df_marks)
