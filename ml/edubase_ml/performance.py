from __future__ import annotations

import json
from typing import Any
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor

from .features import FEATURE_COLUMNS, fetch_feature_data
from .db import get_connection

HEURISTIC_VERSION = "heuristic_v1.0.0"
GBR_VERSION = "gbr_v1.0.0"


def determine_risk_level(predicted_gpa: float, attendance_pct: float) -> str:
    """Classify academic risk based on predicted GPA and attendance percentage."""
    if predicted_gpa < 6.0 or attendance_pct < 75.0:
        return "high"
    if predicted_gpa < 7.0:
        return "medium"
    return "low"


def predict_gpa_heuristic(row: pd.Series | dict[str, Any]) -> tuple[float, dict[str, float]]:
    """Transparent weighted heuristic fallback for GPA prediction with feature contributions."""
    internal = float(row.get("internal_marks_pct", 70.0))
    prev_cgpa = float(row.get("previous_cgpa", 7.0))
    lab = float(row.get("lab_pct", 70.0))
    attendance = float(row.get("attendance_pct", 85.0))
    late = float(row.get("late_ratio", 0.0))

    c_internal = 0.40 * (internal / 10.0)
    c_prev = 0.30 * prev_cgpa
    c_lab = 0.20 * (lab / 10.0)
    c_att = 0.10 * (attendance / 10.0)
    c_late = -0.50 * late

    pred = c_internal + c_prev + c_lab + c_att + c_late
    pred_clamped = max(0.0, min(10.0, pred))
    factors = {
        "internal_marks_contribution": round(c_internal, 2),
        "previous_cgpa_contribution": round(c_prev, 2),
        "lab_contribution": round(c_lab, 2),
        "attendance_contribution": round(c_att, 2),
        "late_penalty": round(c_late, 2),
    }
    return round(pred_clamped, 2), factors


def predict_student_performance(
    df_features: pd.DataFrame,
) -> tuple[list[dict[str, Any]], str]:
    """Train or fallback-heuristic to predict student performance and risk levels."""
    if df_features.empty:
        return [], HEURISTIC_VERSION

    # Check for labelled rows (having non-null credit_weighted_gpa)
    labelled = df_features.dropna(subset=["credit_weighted_gpa"])
    if len(labelled) >= 50:
        model_version = GBR_VERSION
        X_train = labelled[FEATURE_COLUMNS].fillna(0.0).values
        y_train = labelled["credit_weighted_gpa"].values

        model = GradientBoostingRegressor(n_estimators=100, max_depth=3, random_state=42)
        model.fit(X_train, y_train)

        X_all = df_features[FEATURE_COLUMNS].fillna(0.0).values
        raw_preds = model.predict(X_all)
        feature_importances = model.feature_importances_

        # Feature means for contribution estimation
        means = np.mean(X_train, axis=0)
        stds = np.std(X_train, axis=0) + 1e-6

        records: list[dict[str, Any]] = []
        for i, (_, row) in enumerate(df_features.iterrows()):
            pred_val = float(np.clip(raw_preds[i], 0.0, 10.0))
            pred_gpa = round(pred_val, 2)
            att_pct = float(row.get("attendance_pct", 85.0))
            risk = determine_risk_level(pred_gpa, att_pct)

            # Explanatory factors based on normalized difference from mean weighted by feature importance
            row_vals = X_all[i]
            contributions = {}
            for col_idx, col_name in enumerate(FEATURE_COLUMNS):
                z_score = (row_vals[col_idx] - means[col_idx]) / stds[col_idx]
                contrib = float(z_score * feature_importances[col_idx])
                contributions[col_name] = round(contrib, 3)

            # Top 3 feature contributions
            top_factors = dict(sorted(contributions.items(), key=lambda item: abs(item[1]), reverse=True)[:3])

            records.append({
                "student_id": str(row["student_id"]),
                "predicted_gpa": pred_gpa,
                "risk_level": risk,
                "factors": top_factors,
                "attendance_pct": att_pct,
            })
        return records, model_version

    # Fallback to heuristic
    model_version = HEURISTIC_VERSION
    records = []
    for _, row in df_features.iterrows():
        pred_gpa, factors = predict_gpa_heuristic(row)
        att_pct = float(row.get("attendance_pct", 85.0))
        risk = determine_risk_level(pred_gpa, att_pct)
        records.append({
            "student_id": str(row["student_id"]),
            "predicted_gpa": pred_gpa,
            "risk_level": risk,
            "factors": factors,
            "attendance_pct": att_pct,
        })
    return records, model_version


def run_performance_predictions(term_id: str | None = None) -> dict[str, Any]:
    """Execute prediction pipeline, persist to DB, and return summary counts."""
    with get_connection() as conn:
        resolved_term_id = term_id
        if not resolved_term_id:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM public.academic_terms WHERE is_current = true LIMIT 1")
                term_row = cur.fetchone()
                if term_row:
                    resolved_term_id = str(term_row["id"])

        df_features = fetch_feature_data(conn, term_id=resolved_term_id)
        predictions, model_version = predict_student_performance(df_features)

        if not predictions:
            return {
                "total": 0,
                "high_risk": 0,
                "medium_risk": 0,
                "low_risk": 0,
                "model_version": model_version,
                "term_id": resolved_term_id,
            }

        counts = {"high": 0, "medium": 0, "low": 0}
        with conn.cursor() as cur:
            for p in predictions:
                counts[p["risk_level"]] += 1
                cur.execute(
                    """
                    INSERT INTO public.performance_predictions
                        (student_id, term_id, predicted_gpa, risk_level, factors, model_version)
                    VALUES (%s, %s, %s, %s, %s, %s)
                    """,
                    (
                        p["student_id"],
                        resolved_term_id,
                        p["predicted_gpa"],
                        p["risk_level"],
                        json.dumps(p["factors"]),
                        model_version,
                    ),
                )
        conn.commit()

    return {
        "total": len(predictions),
        "high_risk": counts["high"],
        "medium_risk": counts["medium"],
        "low_risk": counts["low"],
        "model_version": model_version,
        "term_id": resolved_term_id,
    }
