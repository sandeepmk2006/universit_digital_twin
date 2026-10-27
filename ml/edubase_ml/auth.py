from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from fastapi import Depends, Header, HTTPException, status
import httpx

from .config import settings
from .db import get_connection

STAFF_EXCLUDED_ROLES = {"student", "alumni"}


def is_staff_role(role: str | None) -> bool:
    return (role or "").strip().lower() not in STAFF_EXCLUDED_ROLES


@dataclass
class AuthUser:
    user_id: str
    email: str
    role: str = "student"
    full_name: str = ""
    student_id: str | None = None
    program_id: str | None = None
    current_semester: int | None = None

    @property
    def is_staff(self) -> bool:
        return is_staff_role(self.role)


def verify_supabase_token(token: str) -> dict[str, Any]:
    url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
    headers = {
        "Authorization": f"Bearer {token}",
        "apikey": settings.SUPABASE_PUBLISHABLE_KEY,
    }
    try:
        response = httpx.get(url, headers=headers, timeout=10.0)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Auth service unreachable: {exc}",
        ) from exc

    if response.status_code != 200:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        )
    return response.json()


def resolve_auth_user(user_id: str, email: str = "") -> AuthUser:
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, role, full_name, email FROM public.profiles WHERE id = %s",
                (user_id,),
            )
            profile_row = cur.fetchone()

            cur.execute(
                """
                SELECT id, program_id, current_semester
                FROM public.students
                WHERE profile_id = %s
                """,
                (user_id,),
            )
            student_row = cur.fetchone()

    role = profile_row["role"] if profile_row else "student"
    full_name = profile_row["full_name"] if profile_row else ""
    user_email = profile_row["email"] if profile_row else email

    student_id = str(student_row["id"]) if student_row else None
    program_id = str(student_row["program_id"]) if student_row and student_row["program_id"] else None
    current_semester = student_row["current_semester"] if student_row else None

    return AuthUser(
        user_id=user_id,
        email=user_email,
        role=role,
        full_name=full_name,
        student_id=student_id,
        program_id=program_id,
        current_semester=current_semester,
    )


def get_current_user(authorization: str | None = Header(None)) -> AuthUser:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )
    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be Bearer token",
        )
    token = parts[1]
    user_data = verify_supabase_token(token)
    user_id = user_data.get("id")
    email = user_data.get("email", "")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token payload missing user id",
        )
    return resolve_auth_user(user_id, email)


def require_staff(user: AuthUser = Depends(get_current_user)) -> AuthUser:
    if not user.is_staff:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: staff access required",
        )
    return user


def require_student_or_staff(
    student_id: str,
    user: AuthUser = Depends(get_current_user),
) -> AuthUser:
    if user.is_staff:
        return user
    if user.student_id and str(user.student_id) == str(student_id):
        return user
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Forbidden: students can only access their own recommendations",
    )

