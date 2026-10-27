from __future__ import annotations

from typing import Any
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .allocation import allocate_rooms_for_term
from .assistant import chat_turn, reindex_kb_documents
from .auth import AuthUser, get_current_user, require_staff, require_student_or_staff
from .config import settings
from .electives import recommend_electives_for_student
from .performance import run_performance_predictions
from .placement import recommend_placement_prep

app = FastAPI(
    title="EduBase Intelligence Service",
    description="Machine Learning and AI service for the EduBase digital twin university platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictPerformanceBody(BaseModel):
    term_id: str | None = None


class ChatBody(BaseModel):
    message: str
    session_id: str | None = None


@app.get("/health", tags=["Health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/predict/performance", tags=["Performance"])
def predict_performance(
    body: PredictPerformanceBody | None = None,
    user: AuthUser = Depends(require_staff),
) -> dict[str, Any]:
    term_id = body.term_id if body else None
    return run_performance_predictions(term_id=term_id)


@app.post("/recommend/electives/{student_id}", tags=["Recommendations"])
def recommend_electives(
    student_id: str,
    user: AuthUser = Depends(require_student_or_staff),
) -> list[dict[str, Any]]:
    recommendations = recommend_electives_for_student(student_id)
    return recommendations


@app.post("/recommend/placement/{student_id}", tags=["Recommendations"])
def recommend_placement(
    student_id: str,
    user: AuthUser = Depends(require_student_or_staff),
) -> list[dict[str, Any]]:
    gaps = recommend_placement_prep(student_id)
    return gaps


@app.post("/allocate/rooms/{term_id}", tags=["Allocation"])
def allocate_rooms(
    term_id: str,
    user: AuthUser = Depends(require_staff),
) -> dict[str, Any]:
    result = allocate_rooms_for_term(term_id)
    if result["status"] == "failed":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=result["stats"].get("error", "Room allocation failed to find a feasible solution"),
        )
    return result


@app.post("/chat", tags=["Assistant"])
def chat(
    body: ChatBody,
    user: AuthUser = Depends(get_current_user),
) -> dict[str, Any]:
    if not body.message.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty",
        )
    return chat_turn(body.message, body.session_id, user)


@app.post("/kb/reindex", tags=["Knowledge Base"])
def reindex_kb(
    user: AuthUser = Depends(require_staff),
) -> dict[str, Any]:
    return reindex_kb_documents()
