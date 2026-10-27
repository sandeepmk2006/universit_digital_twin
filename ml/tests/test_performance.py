from __future__ import annotations

import pandas as pd
from edubase_ml.performance import (
    GBR_VERSION,
    HEURISTIC_VERSION,
    determine_risk_level,
    predict_gpa_heuristic,
    predict_student_performance,
)


def test_heuristic_risk_banding():
    # High risk if predicted < 6.0
    assert determine_risk_level(predicted_gpa=5.9, attendance_pct=90.0) == "high"
    # High risk if attendance < 75.0 even if predicted is high
    assert determine_risk_level(predicted_gpa=8.5, attendance_pct=74.9) == "high"
    assert determine_risk_level(predicted_gpa=5.5, attendance_pct=60.0) == "high"

    # Medium risk if predicted < 7.0 (and attendance >= 75)
    assert determine_risk_level(predicted_gpa=6.0, attendance_pct=80.0) == "medium"
    assert determine_risk_level(predicted_gpa=6.99, attendance_pct=75.0) == "medium"

    # Low risk if predicted >= 7.0 and attendance >= 75.0
    assert determine_risk_level(predicted_gpa=7.0, attendance_pct=75.0) == "low"
    assert determine_risk_level(predicted_gpa=9.2, attendance_pct=95.0) == "low"


def test_predict_gpa_heuristic_calculation():
    row = {
        "internal_marks_pct": 80.0,
        "previous_cgpa": 8.0,
        "lab_pct": 80.0,
        "attendance_pct": 90.0,
        "late_ratio": 0.1,
    }
    # c_internal = 0.40 * 8.0 = 3.2
    # c_prev     = 0.30 * 8.0 = 2.4
    # c_lab      = 0.20 * 8.0 = 1.6
    # c_att      = 0.10 * 9.0 = 0.9
    # c_late     = -0.50 * 0.1 = -0.05
    # total = 3.2 + 2.4 + 1.6 + 0.9 - 0.05 = 8.05
    pred, factors = predict_gpa_heuristic(row)
    assert pred == 8.05
    assert factors["internal_marks_contribution"] == 3.2
    assert factors["previous_cgpa_contribution"] == 2.4
    assert factors["lab_contribution"] == 1.6
    assert factors["attendance_contribution"] == 0.9
    assert factors["late_penalty"] == -0.05


def test_performance_prediction_fallback_under_50_rows():
    df = pd.DataFrame([
        {
            "student_id": f"s{i}",
            "attendance_pct": 80.0,
            "internal_marks_pct": 75.0,
            "lab_pct": 75.0,
            "previous_cgpa": 7.5,
            "credit_load": 20.0,
            "late_ratio": 0.05,
            "credit_weighted_gpa": 7.5 if i < 10 else None,
        }
        for i in range(20)
    ])

    preds, version = predict_student_performance(df)
    assert version == HEURISTIC_VERSION
    assert len(preds) == 20
    assert preds[0]["risk_level"] in ("low", "medium", "high")
    assert "internal_marks_contribution" in preds[0]["factors"]


def test_performance_prediction_gbr_over_50_rows():
    rows = []
    for i in range(60):
        rows.append({
            "student_id": f"s{i}",
            "attendance_pct": 60.0 + (i % 40),
            "internal_marks_pct": 50.0 + (i % 50),
            "lab_pct": 60.0 + (i % 35),
            "previous_cgpa": 5.0 + (i % 50) / 10.0,
            "credit_load": 18.0 + (i % 6),
            "late_ratio": 0.02 * (i % 10),
            "credit_weighted_gpa": 5.0 + (i % 50) / 10.0,
        })
    df = pd.DataFrame(rows)

    preds, version = predict_student_performance(df)
    assert version == GBR_VERSION
    assert len(preds) == 60
    assert "predicted_gpa" in preds[0]
    assert 0.0 <= preds[0]["predicted_gpa"] <= 10.0
    assert len(preds[0]["factors"]) <= 3
