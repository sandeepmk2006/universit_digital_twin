from __future__ import annotations

import numpy as np
import pandas as pd
from edubase_ml.features import compute_features_from_dataframes


def test_empty_students_dataframe():
    df_empty = pd.DataFrame()
    res = compute_features_from_dataframes(df_empty, pd.DataFrame(), pd.DataFrame(), pd.DataFrame())
    assert res.empty
    assert "student_id" in res.columns
    assert "attendance_pct" in res.columns


def test_feature_engineering_with_complete_student():
    df_students = pd.DataFrame([
        {"id": "s1", "roll_no": "CS001", "full_name": "Alice", "cgpa": 8.5, "status": "active"}
    ])

    df_enrollments = pd.DataFrame([
        {"student_id": "s1", "section_id": "sec1", "grade_point": 9.0, "credits": 4},
        {"student_id": "s1", "section_id": "sec2", "grade_point": 8.0, "credits": 3},
    ])

    # 4 sessions: 2 present, 1 late, 1 absent -> attended = 3/4 = 75%, late_ratio = 1/4 = 0.25
    df_attendance = pd.DataFrame([
        {"student_id": "s1", "session_id": "sess1", "status": "present"},
        {"student_id": "s1", "session_id": "sess2", "status": "late"},
        {"student_id": "s1", "session_id": "sess3", "status": "present"},
        {"student_id": "s1", "session_id": "sess4", "status": "absent"},
    ])

    # Marks:
    # internal_1: 20/25, assignment: 22/25 -> total internal = 42/50 = 84%
    # lab: 45/50 = 90%
    df_marks = pd.DataFrame([
        {"student_id": "s1", "exam_id": "e1", "kind": "internal_1", "obtained": 20, "max_marks": 25, "weightage": 20},
        {"student_id": "s1", "exam_id": "e2", "kind": "assignment", "obtained": 22, "max_marks": 25, "weightage": 20},
        {"student_id": "s1", "exam_id": "e3", "kind": "lab", "obtained": 45, "max_marks": 50, "weightage": 30},
    ])

    res = compute_features_from_dataframes(df_students, df_enrollments, df_attendance, df_marks)
    assert len(res) == 1
    row = res.iloc[0]

    assert row["student_id"] == "s1"
    assert row["attendance_pct"] == 75.0
    assert row["late_ratio"] == 0.25
    assert row["internal_marks_pct"] == 84.0
    assert row["lab_pct"] == 90.0
    assert row["previous_cgpa"] == 8.5
    assert row["credit_load"] == 7.0

    # Target weighted GPA: (9.0*4 + 8.0*3) / 7 = (36 + 24) / 7 = 60/7 = 8.57
    assert row["credit_weighted_gpa"] == 8.57


def test_feature_engineering_defaults_without_attendance_or_marks():
    df_students = pd.DataFrame([
        {"id": "s2", "roll_no": "CS002", "full_name": "Bob", "cgpa": None, "status": "active"}
    ])

    res = compute_features_from_dataframes(df_students, pd.DataFrame(), pd.DataFrame(), pd.DataFrame())
    assert len(res) == 1
    row = res.iloc[0]

    assert row["student_id"] == "s2"
    assert row["attendance_pct"] == 85.0
    assert row["late_ratio"] == 0.0
    assert row["previous_cgpa"] == 7.0
    assert row["internal_marks_pct"] == 70.0
    assert row["lab_pct"] == 70.0
    assert row["credit_load"] == 20.0
    assert np.isnan(row["credit_weighted_gpa"])
